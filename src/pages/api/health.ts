import type { APIRoute } from "astro";
import { json } from "../../lib/server/responses";
import { getEnv } from "../../lib/server/env";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const dbPing = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    const voteColumns = await env.DB.prepare("PRAGMA table_info('submission_votes')").all<{ name: string }>();
    const voteIdentity = (voteColumns.results ?? []).find((row) =>
      ["participant_email", "normalized_email"].includes(String(row.name || ""))
    );

    return json({
      ok: true,
      db: dbPing?.ok === 1,
      voteIdentityColumn: voteIdentity?.name || null
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Health check failed."
      },
      500
    );
  }
};

