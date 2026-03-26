import type { APIRoute } from "astro";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { createParticipantMagicLink } from "../../../../../lib/server/participant-auth";
import { normalizeEmail, isValidEmail } from "../../../../../lib/server/email";
import { enforceRateLimit, getClientIp } from "../../../../../lib/server/rate-limit";
import { getParticipantAccessState } from "../../../../../lib/server/participant-workspace";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    const requestUrl = new URL(context.request.url);
    const organizerId = String(requestUrl.searchParams.get("organizerId") || "").trim();
    if (!slug) {
      return json({ error: "Missing event slug." }, 400);
    }

    let event: { id: string } | null = null;
    if (organizerId) {
      event = await env.DB.prepare(
        `SELECT id
         FROM events
         WHERE slug = ? AND organizer_id = ? AND is_published = 1`
      )
        .bind(slug, organizerId)
        .first<{ id: string }>();
    } else {
      const matches = await env.DB.prepare(
        `SELECT id
         FROM events
         WHERE slug = ? AND is_published = 1
         ORDER BY created_at DESC`
      )
        .bind(slug)
        .all<{ id: string }>();
      const rows = matches.results ?? [];
      if (rows.length > 1) {
        return json(
          {
            error:
              "Multiple events share this slug. Use /events/<organizer-id>/<event-slug>.",
            requiresOrganizerId: true
          },
          409
        );
      }
      event = rows[0] ?? null;
    }

    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    const payload = (await context.request.json()) as any;
    const email = normalizeEmail(String(payload.email || ""));
    if (!email) {
      return json({ error: "Email is required." }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    const ip = getClientIp(context.request);
    const byIp = await enforceRateLimit(env, {
      scope: "participant.magic-link.ip",
      key: `${event.id}:${ip}`,
      limit: 12,
      windowSeconds: 15 * 60
    });
    if (!byIp.ok) {
      return json(
        { error: "Too many access-link requests. Please try again shortly." },
        429,
        { "retry-after": String(byIp.retryAfterSeconds) }
      );
    }

    const byEmail = await enforceRateLimit(env, {
      scope: "participant.magic-link.email",
      key: `${event.id}:${email}`,
      limit: 6,
      windowSeconds: 15 * 60
    });
    if (!byEmail.ok) {
      return json(
        { error: "Too many access-link requests for this email. Please try again later." },
        429,
        { "retry-after": String(byEmail.retryAfterSeconds) }
      );
    }

    const cooldown = await enforceRateLimit(env, {
      scope: "participant.magic-link.cooldown",
      key: `${event.id}:${email}`,
      limit: 1,
      windowSeconds: 45
    });
    if (!cooldown.ok) {
      return json(
        { error: "Please wait a few seconds before requesting another link." },
        429,
        { "retry-after": String(cooldown.retryAfterSeconds) }
      );
    }

    const access = await getParticipantAccessState(env, event.id, email);
    if (!access.allowed) {
      if (access.reason === "pending-application") {
        return json({ error: "Your application is pending organizer review." }, 403);
      }
      if (access.reason === "rejected-application") {
        return json({ error: "Your application was not approved. Contact the organizer if you need help." }, 403);
      }
      return json({ error: "No approved participant access was found for that email." }, 404);
    }

    const magicLink = await createParticipantMagicLink(env, event.id, email);
    const verifyUrl = `/api/participants/verify/${magicLink.token}`;

    return json({
      ok: true,
      verifyUrl,
      expiresAt: magicLink.expiresAt.toISOString()
    });
  } catch {
    return json({ error: "Unable to create participant access link." }, 500);
  }
};
