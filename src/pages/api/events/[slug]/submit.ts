import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { emailPattern } from "../../../../lib/server/validation";

const getValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    if (!slug) {
      return json({ error: "Missing event." }, 400);
    }
    const event = await env.DB.prepare(
      "SELECT id FROM events WHERE slug = ? AND is_published = 1"
    )
      .bind(slug)
      .first<{ id: string }>();

    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    const form = await context.request.formData();
    const teamName = getValue(form, "teamName");
    const projectName = getValue(form, "projectName");
    const description = getValue(form, "description");
    const repoUrl = getValue(form, "repoUrl");
    const demoUrl = getValue(form, "demoUrl");
    const deckUrl = getValue(form, "deckUrl");
    const track = getValue(form, "track");
    const members = getValue(form, "members");
    const contactEmail = getValue(form, "contactEmail");

    if (!teamName || !projectName || !description || !track || !contactEmail || !members) {
      return json({ error: "Please complete all required fields." }, 400);
    }

    if (!emailPattern.test(contactEmail)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    const normalizedContactEmail = contactEmail.toLowerCase();

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO submissions
      (id, event_id, created_at, team_name, project_name, description, repo_url, demo_url, deck_url, track, members, contact_email)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        event.id,
        teamName,
        projectName,
        description,
        repoUrl,
        demoUrl,
        deckUrl,
        track,
        members,
        normalizedContactEmail
      )
      .run();

    return json({ ok: true, id });
  } catch (error) {
    return json({ error: "Unable to save submission." }, 500);
  }
};
