import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const GET: APIRoute = async (context) => {
  const env = getEnv();
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, slug, title, tagline, start_date as startDate, end_date as endDate,
        location, mode, application_deadline as applicationDeadline, is_published as isPublished
       FROM events
       WHERE is_published = 1
       ORDER BY start_date IS NULL, start_date ASC`
    ).all();

    return json({ events: results ?? [] });
  } catch (error) {
    return json({ error: "Unable to load events." }, 500);
  }
};
