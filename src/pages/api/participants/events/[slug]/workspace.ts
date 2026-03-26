import type { APIRoute } from "astro";
import { getEnv } from "../../../../../lib/server/env";
import { json } from "../../../../../lib/server/responses";
import { requireParticipantSession } from "../../../../../lib/server/participant-auth";
import {
  getParticipantDisplayName,
  isParticipantEligibleForEvent,
  loadParticipantTeam,
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

    const application = await env.DB.prepare(
      `SELECT full_name as fullName, track, team_status as teamStatus, idea
       FROM applications
       WHERE event_id = ? AND lower(trim(email)) = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
      .bind(event.id, normalizeEmail(participant.email))
      .first<{ fullName: string | null; track: string | null; teamStatus: string | null; idea: string | null }>();

    const tracks = await env.DB.prepare(
      `SELECT name, description, prize
       FROM event_tracks
       WHERE event_id = ?
       ORDER BY created_at ASC`
    )
      .bind(event.id)
      .all<{ name: string; description: string | null; prize: string | null }>();

    const team = await loadParticipantTeam(env, event.id, participant.email);
    const teams = await loadTeamDirectory(env, event.id);
    const participantDisplayName = await getParticipantDisplayName(env, event.id, participant.email);

    let submission:
      | {
          id: string;
          projectName: string;
          description: string;
          track: string;
          repoUrl: string | null;
          demoUrl: string | null;
          deckUrl: string | null;
          createdAt: string;
        }
      | null = null;

    if (team?.id) {
      submission = await env.DB.prepare(
        `SELECT id, project_name as projectName, description, track,
          repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
          created_at as createdAt
         FROM submissions
         WHERE event_id = ? AND team_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
        .bind(event.id, team.id)
        .first<typeof submission>();
    } else {
      submission = await env.DB.prepare(
        `SELECT id, project_name as projectName, description, track,
          repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
          created_at as createdAt
         FROM submissions
         WHERE event_id = ? AND lower(trim(contact_email)) = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
        .bind(event.id, normalizeEmail(participant.email))
        .first<typeof submission>();
    }

    return json({
      workspace: {
        participant: {
          email: normalizeEmail(participant.email),
          displayName: participantDisplayName,
          applicationTrack: String(application?.track || "").trim(),
          teamStatus: String(application?.teamStatus || "").trim(),
          idea: String(application?.idea || "").trim()
        },
        event,
        tracks: tracks.results ?? [],
        team,
        teams,
        submission
      }
    });
  } catch {
    return json({ error: "Unable to load hacker space." }, 500);
  }
};
