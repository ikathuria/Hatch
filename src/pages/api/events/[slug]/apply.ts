import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { emailPattern } from "../../../../lib/server/validation";
import {
  normalizeApplicationAnswers,
  parseApplicationFormFields,
  parseParticipantLocations
} from "../../../../lib/server/application-config";

const getValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

type EventApplicationRow = {
  id: string;
  location: string | null;
  participantLocationOptions: string | null;
  applicationFormFieldsRaw: string | null;
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

    let event: EventApplicationRow | null = null;
    if (organizerId) {
      event = await env.DB.prepare(
        "SELECT id, location, participant_location_options as participantLocationOptions, application_form_fields as applicationFormFieldsRaw FROM events WHERE slug = ? AND organizer_id = ? AND is_published = 1"
      )
        .bind(slug, organizerId)
        .first<EventApplicationRow>();
    } else {
      const matches = await env.DB.prepare(
        "SELECT id, location, participant_location_options as participantLocationOptions, application_form_fields as applicationFormFieldsRaw FROM events WHERE slug = ? AND is_published = 1 ORDER BY created_at DESC"
      )
        .bind(slug)
        .all<EventApplicationRow>();
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
    const location = getValue(form, "location");
    const teamStatus = getValue(form, "teamStatus");
    const linkedinUrl = getValue(form, "linkedinUrl");
    const githubUrl = getValue(form, "githubUrl");
    const consent = form.get("consent") === "on";
    const applicationFormFields = parseApplicationFormFields(event.applicationFormFieldsRaw);
    const rawCustomAnswers = Object.fromEntries(
      applicationFormFields.map((field) => [field.id, getValue(form, `customField:${field.id}`)])
    );
    const customAnswers = normalizeApplicationAnswers(rawCustomAnswers, applicationFormFields);

    if (!fullName || !email || !location || !teamStatus || !linkedinUrl || !githubUrl || !consent) {
      return json({ error: "Please complete all required fields." }, 400);
    }

    if (!emailPattern.test(email)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    const allowedLocations = parseParticipantLocations(event.participantLocationOptions);
    const fallbackLocation = String(event.location || "").trim();
    const validLocations = allowedLocations.length > 0
      ? allowedLocations
      : fallbackLocation
        ? [fallbackLocation]
        : [];

    if (!validLocations.includes(location)) {
      return json({ error: "Please choose one of the organizer-provided locations." }, 400);
    }

    for (const field of applicationFormFields) {
      if (field.required && !String(customAnswers[field.id] || "").trim()) {
        return json({ error: `Please complete "${field.label}".` }, 400);
      }
      if (field.type === "select" && customAnswers[field.id] && !field.options.includes(customAnswers[field.id])) {
        return json({ error: `Please choose a valid answer for "${field.label}".` }, 400);
      }
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await env.DB.prepare(
      `SELECT id, status
       FROM applications
       WHERE event_id = ? AND lower(trim(email)) = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
      .bind(event.id, normalizedEmail)
      .first<{ id: string; status: string | null }>();

    if (existing?.status === "approved") {
      return json({ error: "This email already has approved access for the event." }, 409);
    }

    if (existing?.status === "pending") {
      return json({ error: "Your application is already pending organizer review." }, 409);
    }

    if (existing?.id) {
      return json({ error: "An application already exists for this email." }, 409);
    }

    const applicationId = crypto.randomUUID();
    const nextStatus = "pending";

    await env.DB.prepare(
      `INSERT INTO applications
      (id, event_id, created_at, full_name, email, organization, role, location, track, team_status, idea, linkedin_url, github_url, status, custom_answers, consent)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        applicationId,
        event.id,
        fullName,
        normalizedEmail,
        "",
        "",
        location,
        "",
        teamStatus,
        "",
        linkedinUrl,
        githubUrl,
        nextStatus,
        JSON.stringify(customAnswers),
        consent ? 1 : 0
      )
      .run();

    return json({ ok: true, id: applicationId, status: nextStatus });
  } catch (error) {
    return json({ error: "Unable to save registration." }, 500);
  }
};
