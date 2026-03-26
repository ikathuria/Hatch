import type { APIRoute } from "astro";
import { getEnv } from "../../../../../lib/server/env";
import { json } from "../../../../../lib/server/responses";
import { requireParticipantSession } from "../../../../../lib/server/participant-auth";
import {
  loadLatestParticipantApplication,
  getParticipantDisplayName,
  isParticipantEligibleForEvent,
  loadParticipantTeam,
  loadParticipantSubmission,
  loadTeamDirectory,
  resolvePublishedEventForParticipant
} from "../../../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../../../lib/server/email";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = String(context.params.slug || "");
    const organizerId = String(new URL(context.request.url).searchParams.get("organizerId") || "").trim();
    const { event, error, status } = await resolvePublishedEventForParticipant(env, slug, organizerId);
    if (!event) {
      return json({ error }, status);
    }

    const { participant, response } = await requireParticipantSession(context.request, env, event.id);
    if (response || !participant) {
      return json({ error: "Participant access required." }, 401);
    }

    const eligible = await isParticipantEligibleForEvent(env, event.id, participant.email);
    if (!eligible) {
      return json({ error: "This participant is not eligible for this workspace." }, 403);
    }

    const application = await loadLatestParticipantApplication(
      env,
      event.id,
      normalizeEmail(participant.email)
    );

    const tracks = await env.DB.prepare(
      `SELECT name, description, prize
       FROM event_tracks
       WHERE event_id = ?
       ORDER BY name COLLATE NOCASE ASC`
    )
      .bind(event.id)
      .all<{ name: string; description: string | null; prize: string | null }>();

    const team = await loadParticipantTeam(env, event.id, participant.email);
    const teams = await loadTeamDirectory(env, event.id);
    const participantDisplayName = await getParticipantDisplayName(env, event.id, participant.email);

    const submission = await loadParticipantSubmission(
      env,
      event.id,
      participant.email,
      team?.id ?? null
    );

    return json({
      workspace: {
        participant: {
          email: normalizeEmail(participant.email),
          displayName: participantDisplayName,
          location: String(application?.location || "").trim(),
          teamStatus: String(application?.teamStatus || "").trim(),
          linkedinUrl: String(application?.linkedinUrl || "").trim(),
          githubUrl: String(application?.githubUrl || "").trim(),
          customAnswers: application?.customAnswers || {}
        },
        event,
        tracks: tracks.results ?? [],
        team,
        teams,
        submission
      }
    });
  } catch {
    return json({ error: "Unable to load Attendee Hub." }, 500);
  }
};
