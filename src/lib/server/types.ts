/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  /** Event banner files; optional until bucket is configured in wrangler.toml */
  UPLOADS?: R2Bucket;
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
}
