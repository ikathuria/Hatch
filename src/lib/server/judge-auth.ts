import { json } from "./responses";
import type { Env } from "./types";
import { buildCookie, clearCookie, parseCookies } from "./cookies";
import { hashSecret, randomToken, sha256Hex } from "./crypto";

const JUDGE_SESSION_COOKIE = "hatch_judge_session";
const JUDGE_SESSION_TTL_DAYS = 7;

export interface JudgeSession {
  id: string;
  eventId: string;
  judgeLinkId: string;
  label: string | null;
  expiresAt: string;
}

export const hashJudgeSecret = hashSecret;

export const createJudgeSessionCookie = (request: Request, token: string) =>
  buildCookie(JUDGE_SESSION_COOKIE, token, request, JUDGE_SESSION_TTL_DAYS * 24 * 60 * 60);

export const clearJudgeSessionCookie = (request: Request) => clearCookie(JUDGE_SESSION_COOKIE, request);

export const createJudgeSession = async (env: Env, judgeLinkId: string, eventId: string) => {
  const sessionId = crypto.randomUUID();
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + JUDGE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    `INSERT INTO judge_sessions (id, event_id, judge_link_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`
  )
    .bind(sessionId, eventId, judgeLinkId, tokenHash, expiresAt.toISOString())
    .run();

  return { sessionId, token, tokenHash, expiresAt };
};

export const getJudgeSessionFromRequest = async (request: Request, env: Env) => {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[JUDGE_SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const result = await env.DB.prepare(
    `SELECT
      judge_sessions.id as id,
      judge_sessions.event_id as event_id,
      judge_sessions.judge_link_id as judge_link_id,
      judge_sessions.expires_at as expires_at,
      judge_links.label as label,
      judge_links.expires_at as link_expires_at,
      judge_links.revoked_at as revoked_at
     FROM judge_sessions
     JOIN judge_links ON judge_sessions.judge_link_id = judge_links.id
     WHERE judge_sessions.token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      event_id: string;
      judge_link_id: string;
      expires_at: string;
      label: string | null;
      link_expires_at: string;
      revoked_at: string | null;
    }>();

  if (!result) return null;

  const sessionExpiresAt = new Date(result.expires_at);
  const linkExpiresAt = new Date(result.link_expires_at);
  const now = Date.now();
  if (
    Number.isNaN(sessionExpiresAt.getTime()) ||
    Number.isNaN(linkExpiresAt.getTime()) ||
    sessionExpiresAt.getTime() < now ||
    linkExpiresAt.getTime() < now ||
    Boolean(result.revoked_at)
  ) {
    await env.DB.prepare("DELETE FROM judge_sessions WHERE id = ?").bind(result.id).run();
    return null;
  }

  await env.DB.prepare(
    "UPDATE judge_sessions SET last_used_at = datetime('now') WHERE id = ?"
  )
    .bind(result.id)
    .run();
  await env.DB.prepare("UPDATE judge_links SET last_used_at = datetime('now') WHERE id = ?")
    .bind(result.judge_link_id)
    .run();

  return {
    id: result.id,
    eventId: result.event_id,
    judgeLinkId: result.judge_link_id,
    label: result.label,
    expiresAt: result.expires_at
  } satisfies JudgeSession;
};

export const requireJudgeSession = async (request: Request, env: Env, eventId?: string) => {
  const judge = await getJudgeSessionFromRequest(request, env);
  if (!judge) {
    return { judge: null, response: json({ error: "Unauthorized" }, 401) };
  }

  if (eventId && judge.eventId !== eventId) {
    return { judge: null, response: json({ error: "Forbidden" }, 403) };
  }

  return { judge, response: null };
};
