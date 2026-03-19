export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
