export const parseCookies = (cookieHeader: string | null) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
};

export const buildCookie = (
  name: string,
  value: string,
  request: Request,
  maxAgeSeconds: number
) => {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? " Secure;" : "";
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax;${secure}`;
};

export const clearCookie = (name: string, request: Request) => buildCookie(name, "deleted", request, 0);
