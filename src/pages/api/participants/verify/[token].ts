import type { APIRoute } from "astro";
import { getEnv } from "../../../../lib/server/env";
import { hashParticipantSecret, createParticipantSession, createParticipantSessionCookie } from "../../../../lib/server/participant-auth";
import { json } from "../../../../lib/server/responses";
import { normalizeEmail, extractEmails } from "../../../../lib/server/email";

const findEligibleEmail = async (env: ReturnType<typeof getEnv>, eventId: string, email: string) => {
  const applications = await env.DB.prepare(
    `SELECT email
     FROM applications
     WHERE event_id = ?`
  )
    .bind(eventId)
    .all<{ email: string }>();

  if ((applications.results ?? []).some((row) => normalizeEmail(row.email) === email)) {
    return true;
  }

  const submissions = await env.DB.prepare(
    `SELECT contact_email as contactEmail, members
     FROM submissions
     WHERE event_id = ?`
  )
    .bind(eventId)
    .all<{ contactEmail: string; members: string | null }>();

  return (submissions.results ?? []).some((row) => {
    if (normalizeEmail(row.contactEmail) === email) return true;
    return extractEmails(row.members ?? "").includes(email);
  });
};

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const token = context.params.token ? String(context.params.token) : "";
    if (!token) {
      return json({ error: "Missing verification token." }, 400);
    }

    const tokenHash = await hashParticipantSecret(token);
    const link = await env.DB.prepare(
      `SELECT id, event_id as eventId, email, expires_at as expiresAt, consumed_at as consumedAt
       FROM participant_magic_links
       WHERE token_hash = ?`
    )
      .bind(tokenHash)
      .first<{
        id: string;
        eventId: string;
        email: string;
        expiresAt: string;
        consumedAt: string | null;
      }>();

    if (!link) {
      return json({ error: "Invalid or expired verification token." }, 404);
    }

    const expiresAt = new Date(link.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now() || link.consumedAt) {
      return json({ error: "Invalid or expired verification token." }, 410);
    }

    const event = await env.DB.prepare(
      `SELECT slug, organizer_id as organizerId
       FROM events
       WHERE id = ?`
    )
      .bind(link.eventId)
      .first<{ slug: string; organizerId: string }>();
    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    const eligible = await findEligibleEmail(env, link.eventId, normalizeEmail(link.email));
    if (!eligible) {
      return json({ error: "This participant is no longer eligible to verify access." }, 403);
    }

    const session = await createParticipantSession(env, link.eventId, link.email);
    await env.DB.prepare(
      "UPDATE participant_magic_links SET consumed_at = datetime('now') WHERE id = ?"
    )
      .bind(link.id)
      .run();

    const requestUrl = new URL(context.request.url);
    const nextPath = String(requestUrl.searchParams.get("next") || "").trim();
    const allowedPrefix = `/events/${event.organizerId}/${event.slug}`;
    const redirectPath = nextPath.startsWith(allowedPrefix) ? nextPath : allowedPrefix;
    const redirectUrl = new URL(redirectPath, context.request.url).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "set-cookie": createParticipantSessionCookie(context.request, session.token)
      }
    });
  } catch {
    return json({ error: "Unable to verify participant access." }, 500);
  }
};
