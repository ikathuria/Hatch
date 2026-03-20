import type { APIRoute } from "astro";
import { getOrganizerFromRequest } from "../../../lib/server/auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const organizer = await getOrganizerFromRequest(context.request, env);
    if (!organizer) {
      return json({ error: "Unauthorized" }, 401);
    }
    return json({
      organizer: {
        id: organizer.id,
        name: organizer.name,
        email: organizer.email
      }
    });
  } catch (error) {
    return json({ error: "Unable to load user info." }, 500);
  }
};
