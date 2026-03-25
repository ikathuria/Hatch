import type { Env } from "./types";
import { sha256Hex } from "./crypto";

export interface RateLimitRule {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export const getClientIp = (request: Request) =>
  String(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"
  )
    .split(",")[0]!
    .trim()
    .toLowerCase();

const cleanupOldWindows = async (env: Env, windowSeconds: number) => {
  const threshold = nowSeconds() - windowSeconds * 4;
  await env.DB.prepare("DELETE FROM request_rate_limits WHERE window_start < ?")
    .bind(threshold)
    .run();
};

export const enforceRateLimit = async (
  env: Env,
  rule: RateLimitRule
): Promise<RateLimitResult> => {
  // If the limiter table is unavailable (e.g. migration pending), do not break auth flows.
  try {
    const current = nowSeconds();
    const windowStart = current - (current % rule.windowSeconds);
    const keyHash = await sha256Hex(`${rule.scope}:${rule.key}`);

    await env.DB.prepare(
      `INSERT INTO request_rate_limits
       (scope, key_hash, window_start, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(scope, key_hash, window_start)
       DO UPDATE SET
         count = count + 1,
         updated_at = datetime('now')`
    )
      .bind(rule.scope, keyHash, windowStart)
      .run();

    const row = await env.DB.prepare(
      `SELECT count
       FROM request_rate_limits
       WHERE scope = ? AND key_hash = ? AND window_start = ?`
    )
      .bind(rule.scope, keyHash, windowStart)
      .first<{ count: number }>();

    await cleanupOldWindows(env, rule.windowSeconds);

    const count = Number(row?.count ?? 1);
    const remaining = Math.max(0, rule.limit - count);
    if (count > rule.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, windowStart + rule.windowSeconds - current),
        remaining
      };
    }

    return { ok: true, retryAfterSeconds: 0, remaining };
  } catch {
    return { ok: true, retryAfterSeconds: 0, remaining: rule.limit };
  }
};

