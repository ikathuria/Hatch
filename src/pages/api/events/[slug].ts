import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const GET: APIRoute = async (context) => {
  const env = getEnv();
  const slug = context.params.slug ? String(context.params.slug) : "";
  if (!slug) {
    return json({ error: "Missing slug." }, 400);
  }

  try {
    const event = await env.DB.prepare(
      `SELECT id, slug, title, tagline, description,
        start_date as startDate, end_date as endDate,
        location, mode, application_deadline as applicationDeadline, theme
       FROM events
       WHERE slug = ? AND is_published = 1`
    )
      .bind(slug)
      .first<Record<string, unknown>>();

    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    const tracks = await env.DB.prepare(
      "SELECT name, description, prize FROM event_tracks WHERE event_id = ?"
    )
      .bind(event.id)
      .all();

    const faqs = await env.DB.prepare(
      "SELECT question, answer FROM event_faqs WHERE event_id = ?"
    )
      .bind(event.id)
      .all();

    return json({
      event,
      tracks: tracks.results ?? [],
      faqs: faqs.results ?? []
    });
  } catch (error) {
    return json({ error: "Unable to load event." }, 500);
  }
};
