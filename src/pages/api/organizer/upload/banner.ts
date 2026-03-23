import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../lib/server/auth";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import {
  allowedBannerMimeTypes,
  bannerObjectKey,
  BANNER_MEDIA_PREFIX,
  maxBannerBytes
} from "../../../../lib/server/upload-banner";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    if (!env.UPLOADS) {
      return json(
        {
          error:
            "File storage is not configured. Add an R2 bucket binding named UPLOADS in wrangler.toml."
        },
        503
      );
    }

    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const ct = context.request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json({ error: "Expected multipart form data with a file field." }, 400);
    }

    const form = await context.request.formData();
    const entry = form.get("file");
    if (!(entry instanceof File) || entry.size === 0) {
      return json({ error: "Choose an image file to upload." }, 400);
    }

    if (!allowedBannerMimeTypes.has(entry.type)) {
      return json({ error: "Only JPEG, PNG, WebP, and GIF images are allowed." }, 400);
    }

    if (entry.size > maxBannerBytes) {
      return json({ error: `Image must be ${maxBannerBytes / (1024 * 1024)} MB or smaller.` }, 400);
    }

    const id = crypto.randomUUID();
    const key = bannerObjectKey(id);

    await env.UPLOADS.put(key, entry.stream(), {
      httpMetadata: { contentType: entry.type }
    });

    const url = new URL(context.request.url);
    const relativePath = `${BANNER_MEDIA_PREFIX}${id}`;
    const absoluteUrl = `${url.origin}${relativePath}`;

    return json({
      id,
      url: relativePath,
      absoluteUrl
    });
  } catch {
    return json({ error: "Upload failed." }, 500);
  }
};
