import { json } from "./responses";
import type { Env, Organizer } from "./types";

const encoder = new TextEncoder();
const SESSION_COOKIE = "hatch_session";
const SESSION_TTL_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;

const toHex = (data: Uint8Array) =>
  Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

export const hashPassword = async (password: string, salt?: Uint8Array) => {
  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: actualSalt
    },
    keyMaterial,
    256
  );

  return {
    hash: toHex(new Uint8Array(derivedBits)),
    salt: toHex(actualSalt)
  };
};

export const verifyPassword = async (password: string, hash: string, salt: string) => {
  const derived = await hashPassword(password, fromHex(salt));
  return derived.hash === hash;
};

const parseCookies = (cookieHeader: string | null) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
};

const buildSessionCookie = (token: string, request: Request, maxAgeSeconds: number) => {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax;${secure}`;
};

export const clearSessionCookie = (request: Request) =>
  buildSessionCookie("deleted", request, 0);

export const createSessionCookie = (request: Request, token: string) =>
  buildSessionCookie(token, request, SESSION_TTL_DAYS * 24 * 60 * 60);

export const createSession = async (env: Env, organizerId: string) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (id, organizer_id, created_at, expires_at) VALUES (?, ?, datetime('now'), ?)"
  )
    .bind(sessionId, organizerId, expiresAt.toISOString())
    .run();
  return { sessionId, expiresAt };
};

export const getOrganizerFromRequest = async (request: Request, env: Env) => {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const result = await env.DB.prepare(
    `SELECT sessions.id as session_id, sessions.expires_at as expires_at,
      organizers.id as id, organizers.name as name, organizers.email as email
      FROM sessions
      JOIN organizers ON sessions.organizer_id = organizers.id
      WHERE sessions.id = ?`
  )
    .bind(token)
    .first<Organizer & { expires_at: string }>();

  if (!result) return null;

  const expiresAt = new Date(result.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    email: result.email,
    sessionId: token
  };
};

export const requireOrganizer = async (request: Request, env: Env) => {
  const organizer = await getOrganizerFromRequest(request, env);
  if (!organizer) {
    return { organizer: null, response: json({ error: "Unauthorized" }, 401) };
  }
  return { organizer, response: null };
};
