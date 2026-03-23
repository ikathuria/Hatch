import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../lib/server/auth";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { normalizeSlug, slugPattern } from "../../../../lib/server/validation";
import { isTrustedBannerReference } from "../../../../lib/server/upload-banner";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;
    const { results } = await env.DB.prepare(
      `SELECT id, organizer_id as organizerId, slug, title, tagline, start_date as startDate, end_date as endDate,
        location, mode, application_deadline as applicationDeadline, is_published as isPublished
       FROM events
       WHERE organizer_id = ?
       ORDER BY created_at DESC`
    )
      .bind(organizer?.id)
      .all();

    return json({ events: results ?? [] });
  } catch (error) {
    return json({ error: "Unable to load events." }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;
    const payload = (await context.request.json()) as any;
    const title = String(payload.title || "").trim();
    const slug = normalizeSlug(String(payload.slug || "").trim());
    const tagline = String(payload.tagline || "").trim();
    const description = String(payload.description || "").trim();
    const startDate = String(payload.startDate || "").trim();
    const endDate = String(payload.endDate || "").trim();
    const mode = String(payload.mode || "Hybrid").trim();
    const organizationName = String(payload.organizationName || "").trim();
    const location = String(payload.location || "").trim();
    const applicationDeadline = String(payload.applicationDeadline || "").trim();
    const theme = String(payload.theme || "").trim();
    const websiteUrl = String(payload.websiteUrl || "").trim();
    const twitterUrl = String(payload.twitterUrl || "").trim();
    const discordUrl = String(payload.discordUrl || "").trim();
    const bannerUrl = String(payload.bannerUrl || "").trim();
    if (bannerUrl && !isTrustedBannerReference(bannerUrl)) {
      return json(
        { error: "Banner must be a secure https URL or an image uploaded from the dashboard." },
        400
      );
    }
    const maxParticipantsRaw = payload.maxParticipants;
    const maxParticipants =
      maxParticipantsRaw === "" || maxParticipantsRaw === null || maxParticipantsRaw === undefined
        ? null
        : parseInt(String(maxParticipantsRaw), 10);
    const isPublished = payload.isPublished ? 1 : 0;

    if (!title || !slug) {
      return json({ error: "Title and slug are required." }, 400);
    }

    if (!slugPattern.test(slug)) {
      return json({ error: "Slug must be lowercase letters, numbers, and hyphens." }, 400);
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM events WHERE organizer_id = ? AND slug = ?"
    )
      .bind(organizer?.id, slug)
      .first();
    if (existing) {
      return json({ error: "That slug is already taken." }, 409);
    }

    const eventId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO events (
        id, organizer_id, created_at, updated_at, slug, title, tagline, description,
        start_date, end_date, mode, organization_name, location,
        website_url, twitter_url, discord_url, max_participants,
        application_deadline, theme, banner_url, is_published
      ) VALUES (?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        eventId,
        organizer?.id,
        slug,
        title,
        tagline,
        description,
        startDate,
        endDate,
        mode,
        organizationName,
        location,
        websiteUrl,
        twitterUrl,
        discordUrl,
        Number.isFinite(maxParticipants) ? maxParticipants : null,
        applicationDeadline,
        theme,
        bannerUrl,
        isPublished
      )
      .run();

    return json(
      {
        event: {
          id: eventId,
          organizerId: organizer?.id,
          slug,
          title,
          tagline,
          startDate,
          endDate,
          location,
          mode,
          applicationDeadline,
          isPublished: Boolean(isPublished)
        }
      },
      201
    );
  } catch (error) {
    return json({ error: "Unable to create event." }, 500);
  }
};
