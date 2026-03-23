import type { APIRoute } from "astro";
import { clearJudgeSessionCookie, getJudgeSessionFromRequest } from "../../../lib/server/judge-auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const judge = await getJudgeSessionFromRequest(context.request, env);

    if (judge?.id) {
      await env.DB.prepare("DELETE FROM judge_sessions WHERE id = ?").bind(judge.id).run();
    }

    return json(
      { ok: true },
      200,
      {
        "set-cookie": clearJudgeSessionCookie(context.request)
      }
    );
  } catch {
    return json({ error: "Unable to sign out judge." }, 500);
  }
};
