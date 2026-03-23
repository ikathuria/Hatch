import type { APIRoute } from "astro";
import { getEnv } from "../../../lib/server/env";
import { getParticipantSessionFromRequest } from "../../../lib/server/participant-auth";
import { json } from "../../../lib/server/responses";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const participant = await getParticipantSessionFromRequest(context.request, env);
    if (!participant) {
      return json({ participant: null });
    }

    return json({
      participant: {
        id: participant.id,
        eventId: participant.eventId,
        email: participant.email,
        expiresAt: participant.expiresAt
      }
    });
  } catch {
    return json({ error: "Unable to load participant info." }, 500);
  }
};
