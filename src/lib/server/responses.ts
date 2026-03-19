export const json = (
  data: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers
    }
  });

export const text = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers
    }
  });
