import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";
import { getParticipantSessionFromRequest } from "../../../lib/server/participant-auth";
import { getParticipantAccessState } from "../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../lib/server/email";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const participant = await getParticipantSessionFromRequest(context.request, env);
    const { results: events } = await env.DB.prepare(
      `SELECT id, organizer_id as organizerId, slug, title, tagline, start_date as startDate, end_date as endDate,
        location, mode, organization_name as organizationName, theme
       FROM events
       WHERE is_published = 1
       ORDER BY start_date ASC`
    ).all();

    const participantEmail = normalizeEmail(String(participant?.email || ""));
    const enrichedEvents = await Promise.all(
      (events ?? []).map(async (event) => {
        if (!participantEmail) {
          return { ...event, participantStatus: null };
        }

        const access = await getParticipantAccessState(env, String(event.id || ""), participantEmail);
        return {
          ...event,
          participantStatus: access.reason
        };
      })
    );

    return json({ events: enrichedEvents });
  } catch (error) {
    return json({ error: "Unable to load events." }, 500);
  }
};
