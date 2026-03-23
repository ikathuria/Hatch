/** Relative URL path prefix for uploaded banner images (served by GET /api/media/banner/[id]). */
export const BANNER_MEDIA_PREFIX = "/api/media/banner/";

/** RFC 4122 version 4 (matches `crypto.randomUUID()`). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isBannerObjectId = (id: string) => UUID_RE.test(id);

export const allowedBannerMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

export const maxBannerBytes = 5 * 1024 * 1024;

export const bannerObjectKey = (id: string) => `banners/${id}`;

/** True if value is an absolute http(s) URL or our app-relative banner media path. */
export const isTrustedBannerReference = (value: string) => {
  const s = value.trim();
  if (!s) return false;
  if (s.startsWith(BANNER_MEDIA_PREFIX) && isBannerObjectId(s.slice(BANNER_MEDIA_PREFIX.length))) {
    return true;
  }
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
