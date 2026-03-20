import type { Env } from "./types";

let cfEnv: any = null;

/**
 * Attempt to pre-load the Cloudflare environment from the virtual module.
 * This works in Production/Wrangler and Astro 6 dev mode with workerd.
 */
(async () => {
  try {
    // @ts-ignore
    const { env } = await import("cloudflare:workers");
    cfEnv = env;
  } catch (e) {
    // This is expected to fail in standard Node.js or older Vite environments.
  }
})();

/**
 * Extracts the Cloudflare runtime environment (D1, etc.) in a robust way.
 * Works across Astro dev mode and Wrangler/Production.
 */
export const getEnv = (runtime?: any): Env => {
  // 1. check explicitly passed runtime (e.g. context.locals)
  // In Astro 6, bindings may be directly on locals.
  if (runtime?.DB) return runtime as unknown as Env;
  if (runtime?.env?.DB) return runtime.env as unknown as Env;

  // 2. Check the pre-loaded cfEnv from cloudflare:workers import
  if (cfEnv?.DB) return cfEnv as unknown as Env;

  // 3. Check the Astro global runtime symbol (Astro 6 dev mode fallback)
  // @ts-ignore
  const astroRuntime = (globalThis as any)[Symbol.for("astro.runtime")];
  if (astroRuntime?.env?.DB) return astroRuntime.env as unknown as Env;

  // 4. Check globalThis directly (some production/wrangler contexts)
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
     return globalThis as unknown as Env;
  }

  throw new Error("Unable to locate Cloudflare D1 database. Ensure D1 bindings are configured in wrangler.toml.");
};
