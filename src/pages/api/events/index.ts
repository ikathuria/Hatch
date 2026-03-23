import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { results: events } = await env.DB.prepare(
      `SELECT id, organizer_id as organizerId, slug, title, tagline, start_date as startDate, end_date as endDate,
        location, mode, organization_name as organizationName, theme
       FROM events
       WHERE is_published = 1
       ORDER BY start_date ASC`
    ).all();

    return json({ events: events ?? [] });
  } catch (error) {
    return json({ error: "Unable to load events." }, 500);
  }
};
