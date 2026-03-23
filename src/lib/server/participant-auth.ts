import { json } from "./responses";
import type { Env } from "./types";
import { buildCookie, clearCookie, parseCookies } from "./cookies";
import { randomToken, sha256Hex } from "./crypto";

const PARTICIPANT_SESSION_COOKIE = "hatch_participant_session";
const PARTICIPANT_SESSION_TTL_DAYS = 7;
const PARTICIPANT_MAGIC_LINK_TTL_HOURS = 24;

export interface ParticipantSession {
  id: string;
  eventId: string;
  email: string;
  expiresAt: string;
}

export const hashParticipantSecret = sha256Hex;

export const createParticipantSessionCookie = (request: Request, token: string) =>
  buildCookie(
    PARTICIPANT_SESSION_COOKIE,
    token,
    request,
    PARTICIPANT_SESSION_TTL_DAYS * 24 * 60 * 60
  );

export const clearParticipantSessionCookie = (request: Request) =>
  clearCookie(PARTICIPANT_SESSION_COOKIE, request);

export const createParticipantSession = async (env: Env, eventId: string, email: string) => {
  const sessionId = crypto.randomUUID();
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + PARTICIPANT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    `INSERT INTO participant_sessions (id, event_id, email, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`
  )
    .bind(sessionId, eventId, email, tokenHash, expiresAt.toISOString())
    .run();

  return { sessionId, token, tokenHash, expiresAt };
};

export const createParticipantMagicLink = async (
  env: Env,
  eventId: string,
  email: string
) => {
  const linkId = crypto.randomUUID();
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + PARTICIPANT_MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000
  );

  await env.DB.prepare(
    `INSERT INTO participant_magic_links (id, event_id, email, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`
  )
    .bind(linkId, eventId, email, tokenHash, expiresAt.toISOString())
    .run();

  return { linkId, token, tokenHash, expiresAt };
};

export const getParticipantSessionFromRequest = async (request: Request, env: Env) => {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[PARTICIPANT_SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const result = await env.DB.prepare(
    `SELECT id, event_id, email, expires_at
     FROM participant_sessions
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      event_id: string;
      email: string;
      expires_at: string;
    }>();

  if (!result) return null;

  const expiresAt = new Date(result.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM participant_sessions WHERE id = ?").bind(result.id).run();
    return null;
  }

  await env.DB.prepare(
    "UPDATE participant_sessions SET last_used_at = datetime('now') WHERE id = ?"
  )
    .bind(result.id)
    .run();

  return {
    id: result.id,
    eventId: result.event_id,
    email: result.email,
    expiresAt: result.expires_at
  } satisfies ParticipantSession;
};

export const requireParticipantSession = async (request: Request, env: Env, eventId?: string) => {
  const participant = await getParticipantSessionFromRequest(request, env);
  if (!participant) {
    return { participant: null, response: json({ error: "Unauthorized" }, 401) };
  }

  if (eventId && participant.eventId !== eventId) {
    return { participant: null, response: json({ error: "Forbidden" }, 403) };
  }

  return { participant, response: null };
};
