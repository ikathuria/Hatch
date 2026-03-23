import type { APIRoute } from "astro";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { createParticipantMagicLink } from "../../../../../lib/server/participant-auth";
import { normalizeEmail, extractEmails, isValidEmail } from "../../../../../lib/server/email";

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

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    if (!slug) {
      return json({ error: "Missing event slug." }, 400);
    }

    const event = await env.DB.prepare(
      `SELECT id
       FROM events
       WHERE slug = ? AND is_published = 1`
    )
      .bind(slug)
      .first<{ id: string }>();

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

    const eligible = await findEligibleEmail(env, event.id, email);
    if (!eligible) {
      return json({ error: "No participant access was found for that email." }, 404);
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
