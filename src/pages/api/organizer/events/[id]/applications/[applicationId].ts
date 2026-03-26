import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../../lib/server/auth";
import { getEnv } from "../../../../../../lib/server/env";
import { json } from "../../../../../../lib/server/responses";

export const PATCH: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const eventId = String(context.params.id || "").trim();
    const applicationId = String(context.params.applicationId || "").trim();
    if (!eventId || !applicationId) {
      return json({ error: "Missing event or application id." }, 400);
    }

    const event = await env.DB.prepare(
      "SELECT id FROM events WHERE id = ? AND organizer_id = ?"
    )
      .bind(eventId, organizer?.id)
      .first<{ id: string }>();
    if (!event) return json({ error: "Event not found." }, 404);

    const payload = (await context.request.json().catch(() => ({}))) as Record<string, unknown>;
    const nextStatus = String(payload.status || "").trim().toLowerCase();
    if (nextStatus !== "approved" && nextStatus !== "rejected" && nextStatus !== "pending") {
      return json({ error: "Invalid application status." }, 400);
    }

    const result = await env.DB.prepare(
      `UPDATE applications
       SET status = ?, reviewed_at = datetime('now'), reviewed_by_organizer_id = ?
       WHERE id = ? AND event_id = ?`
    )
      .bind(nextStatus, organizer?.id, applicationId, eventId)
      .run();

    if (result.meta.changes === 0) {
      return json({ error: "Application not found." }, 404);
    }

    return json({ ok: true, status: nextStatus });
  } catch {
    return json({ error: "Unable to update application status." }, 500);
  }
};
