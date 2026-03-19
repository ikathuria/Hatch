import { env } from "cloudflare:workers";
import type { Env } from "./types";

export const getEnv = (): Env => {
  console.log("getEnv called, env is:", env ? Object.keys(env) : "null/undefined");
  if (!env || !(env as any).DB) {
    throw new Error("Missing Cloudflare runtime env or DB binding.");
  }
  return env as unknown as Env;
};
