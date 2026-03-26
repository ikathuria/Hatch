import type { APIRoute } from "astro";
import { getEnv } from "../../../../../lib/server/env";
import { json } from "../../../../../lib/server/responses";
import { requireParticipantSession } from "../../../../../lib/server/participant-auth";
import {
  generateJoinCode,
  getParticipantDisplayName,
  isParticipantEligibleForEvent,
  loadParticipantTeam,
  resolvePublishedEventForParticipant
} from "../../../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../../../lib/server/email";

const getTeamMutationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNIQUE constraint failed: participant_teams.event_id, participant_teams.name")) {
    return { error: "That team name is already taken.", status: 409 };
  }
  if (
    message.includes(
      "UNIQUE constraint failed: participant_team_members.event_id, participant_team_members.participant_email"
    )
  ) {
    return { error: "You are already on a team for this event.", status: 409 };
  }
  if (
    message.includes(
      "UNIQUE constraint failed: participant_team_members.team_id, participant_team_members.participant_email"
    )
  ) {
    return { error: "You are already on this team.", status: 409 };
  }

  return null;
};

export const POST: APIRoute = async (context) => {
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
      return json({ error: "This participant is not eligible to create a team." }, 403);
    }

    const existingTeam = await loadParticipantTeam(env, event.id, participant.email);
    if (existingTeam) {
      return json({ error: "You are already on a team for this event." }, 409);
    }

    const payload = await context.request.json().catch(() => ({}));
    const name = String(payload?.name || "").trim();
    if (!name) {
      return json({ error: "Team name is required." }, 400);
    }

    const collision = await env.DB.prepare(
      `SELECT id
       FROM participant_teams
       WHERE event_id = ? AND lower(trim(name)) = lower(trim(?))`
    )
      .bind(event.id, name)
      .first<{ id: string }>();

    if (collision) {
      return json({ error: "That team name is already taken." }, 409);
    }

    const teamId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const joinCode = await generateJoinCode(env, event.id);
    const normalizedEmail = normalizeEmail(participant.email);
    const displayName = await getParticipantDisplayName(env, event.id, normalizedEmail);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO participant_teams
        (id, event_id, name, join_code, created_by_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(teamId, event.id, name, joinCode, normalizedEmail),
      env.DB.prepare(
        `INSERT INTO participant_team_members
        (id, event_id, team_id, participant_email, display_name, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(memberId, event.id, teamId, normalizedEmail, displayName)
    ]);

    return json({ ok: true, teamId });
  } catch (error) {
    const mapped = getTeamMutationError(error);
    if (mapped) {
      return json({ error: mapped.error }, mapped.status);
    }

    return json({ error: "Unable to create team." }, 500);
  }
};
