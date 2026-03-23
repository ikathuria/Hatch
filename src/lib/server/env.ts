import type { Env } from "./types";
import { env as cfBindings } from "cloudflare:workers";

/**
 * Resolves Cloudflare bindings when present (D1, etc.).
 * Returns null when the DB binding is not available.
 *
 * Astro 6 + @astrojs/cloudflare: do not read `locals.runtime.env` — that accessor
 * throws; bindings come from `cloudflare:workers` instead.
 */
export const resolveEnv = (runtime?: any): Env | null => {
  if (runtime?.DB) return runtime as unknown as Env;

  if ((cfBindings as unknown as Env)?.DB) {
    return cfBindings as unknown as Env;
  }

  // @ts-ignore
  const astroRuntime = (globalThis as any)[Symbol.for("astro.runtime")];
  if (astroRuntime?.env?.DB) return astroRuntime.env as unknown as Env;

  // @ts-ignore
  if (typeof globalThis !== "undefined" && (globalThis as any).DB) {
    return globalThis as unknown as Env;
  }

  return null;
};

/**
 * Same as resolveEnv but throws — use from API routes that require D1.
 */
export const getEnv = (runtime?: any): Env => {
  const env = resolveEnv(runtime);
  if (!env) {
    throw new Error(
      "Unable to locate Cloudflare D1 database. Ensure D1 bindings are configured in wrangler.toml."
    );
  }
  return env;
};
