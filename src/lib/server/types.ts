/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  /** Event banner files; optional until bucket is configured in wrangler.toml */
  UPLOADS?: R2Bucket;
  /** Runtime environment marker: production, staging, local, etc. */
  ENVIRONMENT?: string;
  /** Protects debug-only routes/pages unless explicitly enabled. */
  ENABLE_DEBUG_ENV?: string;
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
}
