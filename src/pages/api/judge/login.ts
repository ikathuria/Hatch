import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";
import { createJudgeSession, createJudgeSessionCookie, hashJudgeSecret } from "../../../lib/server/judge-auth";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const payload = (await context.request.json()) as any;
    const token = String(payload.token || "").trim();
    const pin = String(payload.pin || "").trim();

    if (!token) {
      return json({ error: "Judge token is required." }, 400);
    }

    const tokenHash = await hashJudgeSecret(token);
    const judgeLink = await env.DB.prepare(
      `SELECT id, event_id as eventId, label, expires_at as expiresAt, revoked_at as revokedAt, pin_hash as pinHash
       FROM judge_links
       WHERE token_hash = ?`
    )
      .bind(tokenHash)
      .first<{
        id: string;
        eventId: string;
        label: string | null;
        expiresAt: string;
        revokedAt: string | null;
        pinHash: string | null;
      }>();

    if (!judgeLink) {
      return json({ error: "Invalid judge token." }, 401);
    }

    const expiresAt = new Date(judgeLink.expiresAt);
    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() < Date.now() ||
      Boolean(judgeLink.revokedAt)
    ) {
      return json({ error: "This judge link has expired or been revoked." }, 401);
    }

    if (judgeLink.pinHash) {
      const providedPinHash = await hashJudgeSecret(pin);
      if (!pin || providedPinHash !== judgeLink.pinHash) {
        return json({ error: "Invalid judge token or PIN." }, 401);
      }
    }

    const session = await createJudgeSession(env, judgeLink.id, judgeLink.eventId);

    return json(
      {
        judge: {
          eventId: judgeLink.eventId,
          judgeLinkId: judgeLink.id,
          label: judgeLink.label,
          expiresAt: session.expiresAt.toISOString()
        }
      },
      200,
      {
        "set-cookie": createJudgeSessionCookie(context.request, session.token)
      }
    );
  } catch {
    return json({ error: "Unable to sign in judge." }, 500);
  }
};
