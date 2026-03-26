import type { APIRoute } from "astro";
import { getEnv } from "../../../../lib/server/env";
import { getParticipantSessionFromRequest } from "../../../../lib/server/participant-auth";
import { json } from "../../../../lib/server/responses";
import { normalizeEmail } from "../../../../lib/server/email";

type ApplicationRow = {
  eventId: string;
  organizerId: string;
  slug: string;
  title: string;
  tagline: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  mode: string | null;
  organizationName: string | null;
  isPublished: number;
  appliedAt: string;
  status: string | null;
};

type SubmissionRow = {
  eventId: string;
  organizerId: string;
  slug: string;
  title: string;
  tagline: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  mode: string | null;
  organizationName: string | null;
  isPublished: number;
  submittedAt: string;
  projectName: string | null;
};

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const participant = await getParticipantSessionFromRequest(context.request, env);
    if (!participant) {
      return json({ error: "Participant access required." }, 401);
    }

    const email = normalizeEmail(participant.email);

    const applications = await env.DB.prepare(
      `SELECT a.event_id as eventId,
        e.organizer_id as organizerId,
        e.slug,
        e.title,
        e.tagline,
        e.start_date as startDate,
        e.end_date as endDate,
        e.location,
        e.mode,
        e.organization_name as organizationName,
        e.is_published as isPublished,
        a.created_at as appliedAt,
        a.status
       FROM applications a
       INNER JOIN events e ON e.id = a.event_id
       WHERE lower(trim(a.email)) = ?
       ORDER BY a.created_at DESC`
    )
      .bind(email)
      .all<ApplicationRow>();

    const submissions = await env.DB.prepare(
      `SELECT s.event_id as eventId,
        e.organizer_id as organizerId,
        e.slug,
        e.title,
        e.tagline,
        e.start_date as startDate,
        e.end_date as endDate,
        e.location,
        e.mode,
        e.organization_name as organizationName,
        e.is_published as isPublished,
        s.created_at as submittedAt,
        s.project_name as projectName
       FROM submissions s
       INNER JOIN events e ON e.id = s.event_id
       WHERE lower(trim(s.contact_email)) = ?
          OR lower(coalesce(s.members, '')) LIKE ?
       ORDER BY s.created_at DESC`
    )
      .bind(email, `%${email}%`)
      .all<SubmissionRow>();

    const latestApplications = new Map<string, ApplicationRow>();
    for (const row of applications.results ?? []) {
      if (!latestApplications.has(row.eventId)) {
        latestApplications.set(row.eventId, row);
      }
    }

    const latestSubmissions = new Map<string, SubmissionRow>();
    for (const row of submissions.results ?? []) {
      if (!latestSubmissions.has(row.eventId)) {
        latestSubmissions.set(row.eventId, row);
      }
    }

    const eventIds = new Set<string>([
      ...latestApplications.keys(),
      ...latestSubmissions.keys()
    ]);

    const events = Array.from(eventIds)
      .map((eventId) => {
        const application = latestApplications.get(eventId) ?? null;
        const submission = latestSubmissions.get(eventId) ?? null;
        const source = application ?? submission;
        if (!source) return null;

        const status = String(application?.status || "").trim().toLowerCase();
        const hrefBase = source.organizerId
          ? `/events/${source.organizerId}/${source.slug}`
          : `/events/${source.slug}`;
        const isCurrentEvent = participant.eventId === eventId;
        const canOpenHub = isCurrentEvent && (status === "approved" || Boolean(submission));

        return {
          eventId,
          organizerId: source.organizerId,
          slug: source.slug,
          title: source.title,
          tagline: source.tagline,
          startDate: source.startDate,
          endDate: source.endDate,
          location: source.location,
          mode: source.mode,
          organizationName: source.organizationName,
          isPublished: Number(source.isPublished || 0) === 1,
          applicationStatus: status || null,
          appliedAt: application?.appliedAt || null,
          submittedAt: submission?.submittedAt || null,
          projectName: submission?.projectName || null,
          hasSubmission: Boolean(submission),
          isCurrentEvent,
          canOpenHub,
          href:
            Number(source.isPublished || 0) === 1
              ? `${hrefBase}${canOpenHub ? "#hacker-space" : ""}`
              : null
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = new Date(a!.appliedAt || a!.submittedAt || a!.startDate || 0).getTime();
        const bTime = new Date(b!.appliedAt || b!.submittedAt || b!.startDate || 0).getTime();
        return bTime - aTime;
      });

    return json({
      participant: {
        email
      },
      events
    });
  } catch {
    return json({ error: "Unable to load participant events." }, 500);
  }
};
