import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { emailPattern } from "../../../../lib/server/validation";
import { requireParticipantSession } from "../../../../lib/server/participant-auth";
import { extractEmails, normalizeEmail } from "../../../../lib/server/email";
import { loadParticipantTeam } from "../../../../lib/server/participant-workspace";

const getValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const isGitHubRepoUrl = (value: string) =>
  /^https:\/\/github\.com\/.+/i.test(value) || /^github\.com\/.+/i.test(value);

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

    const { participant, response } = await requireParticipantSession(
      context.request,
      env,
      event.id
    );
    if (response) {
      return json(
        { error: "Sign in as an authorized participant before submitting a project." },
        401
      );
    }

    const participantEmail = normalizeEmail(participant!.email);
    const applications = await env.DB.prepare(
      `SELECT email
       FROM applications
       WHERE event_id = ?`
    )
      .bind(event.id)
      .all<{ email: string }>();

    const eligibleByApplication = (applications.results ?? []).some(
      (row) => normalizeEmail(row.email) === participantEmail
    );

    let participantEligible = eligibleByApplication;
    if (!participantEligible) {
      const submissions = await env.DB.prepare(
        `SELECT contact_email as contactEmail, members
         FROM submissions
         WHERE event_id = ?`
      )
        .bind(event.id)
        .all<{ contactEmail: string; members: string | null }>();

      participantEligible = (submissions.results ?? []).some((row) => {
        if (normalizeEmail(row.contactEmail) === participantEmail) return true;
        return extractEmails(row.members ?? "").includes(participantEmail);
      });
    }

    if (!participantEligible) {
      return json({ error: "This participant is not eligible to submit in this event." }, 403);
    }

    const form = await context.request.formData();
    const projectName = getValue(form, "projectName");
    const description = getValue(form, "description");
    const repoUrl = getValue(form, "repoUrl");
    const demoUrl = getValue(form, "demoUrl");
    const deckUrl = getValue(form, "deckUrl");
    const track = getValue(form, "track");
    const submittedTeamName = getValue(form, "teamName");
    const submittedMembers = getValue(form, "members");
    const submittedContactEmail = getValue(form, "contactEmail");

    const participantTeam = await loadParticipantTeam(env, event.id, participantEmail);
    const teamName = participantTeam?.name || submittedTeamName;
    const members =
      participantTeam?.members.map((member) => `${member.displayName} - ${member.email}`).join("\n") ||
      submittedMembers;
    const contactEmail =
      participantTeam?.createdByEmail ||
      participantTeam?.members[0]?.email ||
      submittedContactEmail;

    if (!teamName || !projectName || !description || !track || !contactEmail || !members) {
      return json({ error: "Please complete all required fields." }, 400);
    }

    if (!emailPattern.test(contactEmail)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    if (repoUrl && !isGitHubRepoUrl(repoUrl)) {
      return json(
        { error: "Repository URL must start with https://github.com/ or github.com/." },
        400
      );
    }

    if (participantTeam?.id) {
      const existingSubmission = await env.DB.prepare(
        `SELECT id
         FROM submissions
         WHERE event_id = ? AND team_id = ?`
      )
        .bind(event.id, participantTeam.id)
        .first<{ id: string }>();

      if (existingSubmission) {
        return json({ error: "This team has already submitted a project." }, 409);
      }
    }

    const normalizedContactEmail = contactEmail.toLowerCase();

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO submissions
      (id, event_id, created_at, team_name, project_name, description, repo_url, demo_url, deck_url, track, members, contact_email, team_id, created_by_participant_email)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        event.id,
        teamName,
        projectName,
        description,
        repoUrl,
        demoUrl,
        deckUrl,
        track,
        members,
        normalizedContactEmail,
        participantTeam?.id || null,
        participantEmail
      )
      .run();

    return json({ ok: true, id });
  } catch (error) {
    return json({ error: "Unable to save submission." }, 500);
  }
};
