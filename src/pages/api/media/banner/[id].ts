import type { APIRoute } from "astro";
import { getEnv } from "../../../../lib/server/env";
import { bannerObjectKey, isBannerObjectId } from "../../../../lib/server/upload-banner";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    if (!env.UPLOADS) {
      return new Response("Not configured", { status: 503 });
    }

    const raw = context.params.id ? String(context.params.id) : "";
    if (!isBannerObjectId(raw)) {
      return new Response("Not found", { status: 404 });
    }

    const obj = await env.UPLOADS.get(bannerObjectKey(raw));
    if (!obj) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    const type = obj.httpMetadata?.contentType ?? "application/octet-stream";
    headers.set("Content-Type", type);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(obj.body, { headers });
  } catch {
    return new Response("Error", { status: 500 });
  }
};
