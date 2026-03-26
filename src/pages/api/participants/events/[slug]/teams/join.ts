import type { APIRoute } from "astro";
import { getEnv } from "../../../../../../lib/server/env";
import { json } from "../../../../../../lib/server/responses";
import { requireParticipantSession } from "../../../../../../lib/server/participant-auth";
import {
  getParticipantDisplayName,
  isParticipantEligibleForEvent,
  loadParticipantTeam,
  resolvePublishedEventForParticipant
} from "../../../../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../../../../lib/server/email";

const getTeamJoinError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
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
      return json({ error: "This participant is not eligible to join a team." }, 403);
    }

    const existingTeam = await loadParticipantTeam(env, event.id, participant.email);
    if (existingTeam) {
      return json({ error: "You are already on a team for this event." }, 409);
    }

    const payload = await context.request.json().catch(() => ({}));
    const joinCode = String(payload?.joinCode || "").trim().toUpperCase();
    if (!joinCode) {
      return json({ error: "Join code is required." }, 400);
    }

    const team = await env.DB.prepare(
      `SELECT id
       FROM participant_teams
       WHERE event_id = ? AND join_code = ?`
    )
      .bind(event.id, joinCode)
      .first<{ id: string }>();

    if (!team) {
      return json({ error: "That join code does not match a team in this event." }, 404);
    }

    const normalizedEmail = normalizeEmail(participant.email);
    const displayName = await getParticipantDisplayName(env, event.id, normalizedEmail);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO participant_team_members
        (id, event_id, team_id, participant_email, display_name, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(crypto.randomUUID(), event.id, team.id, normalizedEmail, displayName),
      env.DB.prepare(
        `UPDATE participant_teams
         SET updated_at = datetime('now')
         WHERE id = ?`
      ).bind(team.id)
    ]);

    return json({ ok: true, teamId: team.id });
  } catch (error) {
    const mapped = getTeamJoinError(error);
    if (mapped) {
      return json({ error: mapped.error }, mapped.status);
    }

    return json({ error: "Unable to join team." }, 500);
  }
};
