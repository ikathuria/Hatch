/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
}
