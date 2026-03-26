import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../lib/server/auth";
import { text } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { toCsv } from "../../../../../lib/server/csv";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return text("Missing event id.", 400);

    const event = await env.DB.prepare(
      "SELECT id FROM events WHERE id = ? AND organizer_id = ?"
    )
      .bind(id, organizer?.id)
      .first();
    if (!event) return text("Event not found.", 404);

    const { results } = await env.DB.prepare(
      `SELECT created_at, full_name, email, location, linkedin_url, github_url, team_status, status, custom_answers, reviewed_at, consent
       FROM applications WHERE event_id = ? ORDER BY created_at DESC`
    )
      .bind(id)
      .all();

    const headers = [
      "created_at",
      "full_name",
      "email",
      "location",
      "linkedin_url",
      "github_url",
      "team_status",
      "status",
      "custom_answers",
      "reviewed_at",
      "consent"
    ];
    const csv = toCsv(results ?? [], headers);

    return text(csv, 200, {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="applications-${id}.csv"`
    });
  } catch {
    return text("Unable to export applications.", 500);
  }
};
