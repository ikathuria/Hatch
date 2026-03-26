import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { emailPattern } from "../../../../lib/server/validation";
import {
  createParticipantSession,
  createParticipantSessionCookie
} from "../../../../lib/server/participant-auth";

const getValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    const requestUrl = new URL(context.request.url);
    const organizerId = String(requestUrl.searchParams.get("organizerId") || "").trim();
    if (!slug) {
      return json({ error: "Missing event." }, 400);
    }

    let event: { id: string } | null = null;
    if (organizerId) {
      event = await env.DB.prepare(
        "SELECT id FROM events WHERE slug = ? AND organizer_id = ? AND is_published = 1"
      )
        .bind(slug, organizerId)
        .first<{ id: string }>();
    } else {
      const matches = await env.DB.prepare(
        "SELECT id FROM events WHERE slug = ? AND is_published = 1 ORDER BY created_at DESC"
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

    const form = await context.request.formData();
    const fullName = getValue(form, "fullName");
    const email = getValue(form, "email");
    const organization = getValue(form, "organization");
    const role = getValue(form, "role");
    const location = getValue(form, "location");
    const track = getValue(form, "track");
    const teamStatus = getValue(form, "teamStatus");
    const idea = getValue(form, "idea");
    const consent = form.get("consent") === "on";

    if (!fullName || !email || !role || !track || !consent) {
      return json({ error: "Please complete all required fields." }, 400);
    }

    if (!emailPattern.test(email)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    const normalizedEmail = email.toLowerCase();

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO applications
      (id, event_id, created_at, full_name, email, organization, role, location, track, team_status, idea, consent)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        event.id,
        fullName,
        normalizedEmail,
        organization,
        role,
        location,
        track,
        teamStatus,
        idea,
        consent ? 1 : 0
      )
      .run();

    const session = await createParticipantSession(env, event.id, normalizedEmail);

    return json(
      { ok: true, id },
      200,
      { "set-cookie": createParticipantSessionCookie(context.request, session.token) }
    );
  } catch (error) {
    return json({ error: "Unable to save registration." }, 500);
  }
};
