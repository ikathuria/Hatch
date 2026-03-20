import type { APIRoute } from "astro";
import { clearSessionCookie, getOrganizerFromRequest } from "../../../lib/server/auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const organizer = await getOrganizerFromRequest(context.request, env);
    if (organizer?.sessionId) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(organizer.sessionId)
        .run();
    }

    return json(
      { ok: true },
      200,
      {
        "set-cookie": clearSessionCookie(context.request)
      }
    );
  } catch (error) {
    return json({ error: "Unable to sign out." }, 500);
  }
};
