import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../../../lib/server/auth";
import { json } from "../../../../../../../lib/server/responses";
import { getEnv } from "../../../../../../../lib/server/env";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const eventId = context.params.id ? String(context.params.id) : "";
    const linkId = context.params.linkId ? String(context.params.linkId) : "";
    if (!eventId || !linkId) return json({ error: "Missing event or link id." }, 400);

    const event = await env.DB.prepare(
      `SELECT id FROM events WHERE id = ? AND organizer_id = ?`
    )
      .bind(eventId, organizer!.id)
      .first<{ id: string }>();
    if (!event) return json({ error: "Event not found." }, 404);

    const result = await env.DB.prepare(
      `UPDATE judge_links
       SET revoked_at = datetime('now')
       WHERE id = ? AND event_id = ? AND revoked_at IS NULL`
    )
      .bind(linkId, eventId)
      .run();

    if (result.meta.changes === 0) {
      return json({ error: "Judge link not found." }, 404);
    }

    await env.DB.prepare("DELETE FROM judge_sessions WHERE judge_link_id = ?")
      .bind(linkId)
      .run();

    return json({ ok: true });
  } catch {
    return json({ error: "Unable to revoke judge link." }, 500);
  }
};
