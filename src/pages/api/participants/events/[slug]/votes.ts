import type { APIRoute } from "astro";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { requireParticipantSession } from "../../../../../lib/server/participant-auth";
import { extractEmails, normalizeEmail } from "../../../../../lib/server/email";

const loadEvent = async (env: ReturnType<typeof getEnv>, slug: string) =>
  env.DB.prepare(
    `SELECT id, slug, is_published as isPublished, results_status as resultsStatus
     FROM events
     WHERE slug = ?`
  )
    .bind(slug)
    .first<{ id: string; slug: string; isPublished: number; resultsStatus: string }>();

const loadSubmission = async (env: ReturnType<typeof getEnv>, eventId: string, submissionId: string) =>
  env.DB.prepare(
    `SELECT id, contact_email as contactEmail, members
     FROM submissions
     WHERE id = ? AND event_id = ?`
  )
    .bind(submissionId, eventId)
    .first<{ id: string; contactEmail: string; members: string | null }>();

const isSelfVote = (participantEmail: string, submission: { contactEmail: string; members: string | null }) =>
  normalizeEmail(submission.contactEmail) === participantEmail ||
  extractEmails(submission.members ?? "").includes(participantEmail);

const loadEligibility = async (env: ReturnType<typeof getEnv>, eventId: string, email: string) => {
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
    if (!slug) return json({ error: "Missing event slug." }, 400);

    const event = await loadEvent(env, slug);
    if (!event) return json({ error: "Event not found." }, 404);
    if (!event.isPublished) return json({ error: "Voting is not available for unpublished events." }, 400);
    if (event.resultsStatus !== "published") {
      return json({ error: "Voting opens after results are published." }, 409);
    }

    const { participant, response } = await requireParticipantSession(context.request, env, event.id);
    if (response) return response;

    const participantEligible = await loadEligibility(env, event.id, normalizeEmail(participant!.email));
    if (!participantEligible) {
      return json({ error: "This participant is no longer eligible to vote." }, 403);
    }

    const payload = (await context.request.json()) as any;
    const submissionId = String(payload?.submissionId || "").trim();
    if (!submissionId) return json({ error: "Missing submission id." }, 400);

    const submission = await loadSubmission(env, event.id, submissionId);
    if (!submission) return json({ error: "Submission not found." }, 404);

    const participantEmail = normalizeEmail(participant!.email);
    if (isSelfVote(participantEmail, submission)) {
      return json({ error: "You cannot vote for your own project." }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO submission_votes (id, event_id, submission_id, participant_session_id, participant_email, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(event_id, submission_id, participant_email) DO NOTHING`
    )
      .bind(crypto.randomUUID(), event.id, submissionId, participant!.id, participantEmail)
      .run();

    return json({ ok: true });
  } catch {
    return json({ error: "Unable to save vote." }, 500);
  }
};

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    if (!slug) return json({ error: "Missing event slug." }, 400);

    const event = await loadEvent(env, slug);
    if (!event) return json({ error: "Event not found." }, 404);

    const { participant, response } = await requireParticipantSession(context.request, env, event.id);
    if (response) return response;

    const participantEmail = normalizeEmail(participant!.email);
    const { results } = await env.DB.prepare(
      `SELECT submission_id as submissionId
       FROM submission_votes
       WHERE event_id = ?
         AND (
           participant_email = ?
           OR participant_session_id = ?
         )`
    )
      .bind(event.id, participantEmail, participant!.id)
      .all<{ submissionId: string }>();

    return json({
      votedSubmissionIds: (results ?? []).map((row) => row.submissionId)
    });
  } catch {
    return json({ error: "Unable to load participant votes." }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    if (!slug) return json({ error: "Missing event slug." }, 400);

    const event = await loadEvent(env, slug);
    if (!event) return json({ error: "Event not found." }, 404);
    if (event.resultsStatus !== "published") {
      return json({ error: "Voting is not open yet." }, 409);
    }

    const { participant, response } = await requireParticipantSession(context.request, env, event.id);
    if (response) return response;

    const payload = (await context.request.json().catch(() => ({}))) as any;
    const submissionId = String(payload?.submissionId || "").trim();
    if (!submissionId) return json({ error: "Missing submission id." }, 400);

    const participantEmail = normalizeEmail(participant!.email);
    await env.DB.prepare(
      `DELETE FROM submission_votes
       WHERE event_id = ?
         AND submission_id = ?
         AND (
           participant_email = ?
           OR participant_session_id = ?
         )`
    )
      .bind(event.id, submissionId, participantEmail, participant!.id)
      .run();

    return json({ ok: true });
  } catch {
    return json({ error: "Unable to remove vote." }, 500);
  }
};
