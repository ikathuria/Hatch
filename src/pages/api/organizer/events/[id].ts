import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../lib/server/auth";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { normalizeSlug, slugPattern } from "../../../../lib/server/validation";

export const GET: APIRoute = async (context) => {
  const env = getEnv();
  const { organizer, response } = await requireOrganizer(context.request, env);
  if (response) return response;

  const id = context.params.id ? String(context.params.id) : "";
  if (!id) return json({ error: "Missing event id." }, 400);

  try {
    const event = await env.DB.prepare(
      `SELECT id, slug, title, tagline, description, start_date as startDate, end_date as endDate,
        location, mode, application_deadline as applicationDeadline, theme, is_published as isPublished
       FROM events WHERE id = ? AND organizer_id = ?`
    )
      .bind(id, organizer?.id)
      .first<Record<string, unknown>>();

    if (!event) return json({ error: "Event not found." }, 404);

    const tracks = await env.DB.prepare(
      "SELECT name, description, prize FROM event_tracks WHERE event_id = ?"
    )
      .bind(id)
      .all();

    const faqs = await env.DB.prepare(
      "SELECT question, answer FROM event_faqs WHERE event_id = ?"
    )
      .bind(id)
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

export const PUT: APIRoute = async (context) => {
  const env = getEnv();
  const { organizer, response } = await requireOrganizer(context.request, env);
  if (response) return response;

  const id = context.params.id ? String(context.params.id) : "";
  if (!id) return json({ error: "Missing event id." }, 400);

  try {
    const payload = await context.request.json();
    const title = String(payload.title || "").trim();
    const slug = normalizeSlug(String(payload.slug || "").trim());
    const tagline = String(payload.tagline || "").trim();
    const description = String(payload.description || "").trim();
    const startDate = String(payload.startDate || "").trim();
    const endDate = String(payload.endDate || "").trim();
    const location = String(payload.location || "").trim();
    const mode = String(payload.mode || "").trim();
    const applicationDeadline = String(payload.applicationDeadline || "").trim();
    const theme = String(payload.theme || "").trim();
    const isPublished = payload.isPublished ? 1 : 0;

    if (!title || !slug) {
      return json({ error: "Title and slug are required." }, 400);
    }

    if (!slugPattern.test(slug)) {
      return json({ error: "Slug must be lowercase letters, numbers, and hyphens." }, 400);
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM events WHERE slug = ? AND id != ?"
    )
      .bind(slug, id)
      .first();
    if (existing) {
      return json({ error: "That slug is already taken." }, 409);
    }

    const update = await env.DB.prepare(
      `UPDATE events SET
        slug = ?, title = ?, tagline = ?, description = ?, start_date = ?, end_date = ?,
        location = ?, mode = ?, application_deadline = ?, theme = ?, is_published = ?, updated_at = datetime('now')
       WHERE id = ? AND organizer_id = ?`
    )
      .bind(
        slug,
        title,
        tagline,
        description,
        startDate,
        endDate,
        location,
        mode,
        applicationDeadline,
        theme,
        isPublished,
        id,
        organizer?.id
      )
      .run();

    if (update.changes === 0) {
      return json({ error: "Event not found." }, 404);
    }

    await env.DB.prepare("DELETE FROM event_tracks WHERE event_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM event_faqs WHERE event_id = ?").bind(id).run();

    const trackRows = Array.isArray(payload.tracks) ? payload.tracks : [];
    for (const track of trackRows) {
      if (!track.name) continue;
      await env.DB.prepare(
        "INSERT INTO event_tracks (id, event_id, name, description, prize) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          crypto.randomUUID(),
          id,
          String(track.name).trim(),
          String(track.description || "").trim(),
          String(track.prize || "").trim()
        )
        .run();
    }

    const faqRows = Array.isArray(payload.faqs) ? payload.faqs : [];
    for (const faq of faqRows) {
      if (!faq.question || !faq.answer) continue;
      await env.DB.prepare(
        "INSERT INTO event_faqs (id, event_id, question, answer) VALUES (?, ?, ?, ?)"
      )
        .bind(
          crypto.randomUUID(),
          id,
          String(faq.question).trim(),
          String(faq.answer).trim()
        )
        .run();
    }

    return json({
      event: {
        id,
        slug,
        title,
        tagline,
        description,
        startDate,
        endDate,
        location,
        mode,
        applicationDeadline,
        theme,
        isPublished: Boolean(isPublished)
      }
    });
  } catch (error) {
    return json({ error: "Unable to save event." }, 500);
  }
};
