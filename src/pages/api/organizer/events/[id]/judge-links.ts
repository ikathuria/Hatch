import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../lib/server/auth";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { hashJudgeSecret } from "../../../../../lib/server/judge-auth";
import { randomToken } from "../../../../../lib/server/crypto";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string, organizerId: string) =>
  env.DB.prepare(
    `SELECT id, results_status as resultsStatus
     FROM events
     WHERE id = ? AND organizer_id = ?`
  )
    .bind(eventId, organizerId)
    .first<{ id: string; resultsStatus: string }>();

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await loadEvent(env, id, organizer!.id);
    if (!event) return json({ error: "Event not found." }, 404);

    const links = await env.DB.prepare(
      `SELECT id, label, created_at as createdAt, expires_at as expiresAt,
        last_used_at as lastUsedAt, revoked_at as revokedAt,
        CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END as hasPin
       FROM judge_links
       WHERE event_id = ?
       ORDER BY created_at DESC`
    )
      .bind(id)
      .all<{
        id: string;
        label: string | null;
        createdAt: string;
        expiresAt: string;
        lastUsedAt: string | null;
        revokedAt: string | null;
        hasPin: number;
      }>();

    return json({ links: links.results ?? [] });
  } catch {
    return json({ error: "Unable to load judge links." }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await loadEvent(env, id, organizer!.id);
    if (!event) return json({ error: "Event not found." }, 404);
    if (event.resultsStatus === "published") {
      return json({ error: "Results are already published and judge links are locked." }, 409);
    }

    const payload = (await context.request.json()) as any;
    const label = String(payload.label || "").trim();
    const pin = String(payload.pin || "").trim();
    const expiresAtRaw = String(payload.expiresAt || "").trim();
    const expiresInDaysRaw = String(payload.expiresInDays || "").trim();
    const expiresAt =
      expiresAtRaw && !Number.isNaN(Date.parse(expiresAtRaw))
        ? new Date(expiresAtRaw)
        : new Date(
            Date.now() +
              (Number.parseInt(expiresInDaysRaw, 10) > 0 ? Number.parseInt(expiresInDaysRaw, 10) : 30) *
                24 *
                60 *
                60 *
                1000
          );

    const token = randomToken(32);
    const tokenHash = await hashJudgeSecret(token);
    const pinHash = pin ? await hashJudgeSecret(pin) : null;

    const judgeLinkId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO judge_links
       (id, event_id, label, token_hash, pin_hash, created_by_organizer_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    )
      .bind(judgeLinkId, id, label || null, tokenHash, pinHash, organizer!.id, expiresAt.toISOString())
      .run();

    return json(
      {
        link: {
          id: judgeLinkId,
          label: label || null,
          token,
          expiresAt: expiresAt.toISOString(),
          hasPin: Boolean(pinHash)
        }
      },
      201
    );
  } catch {
    return json({ error: "Unable to create judge link." }, 500);
  }
};
