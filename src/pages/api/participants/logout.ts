import type { APIRoute } from "astro";
import { clearParticipantSessionCookie, getParticipantSessionFromRequest } from "../../../lib/server/participant-auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const participant = await getParticipantSessionFromRequest(context.request, env);

    if (participant?.id) {
      await env.DB.prepare("DELETE FROM participant_sessions WHERE id = ?")
        .bind(participant.id)
        .run();
    }

    return json(
      { ok: true },
      200,
      {
        "set-cookie": clearParticipantSessionCookie(context.request)
      }
    );
  } catch {
    return json({ error: "Unable to sign out participant." }, 500);
  }
};
