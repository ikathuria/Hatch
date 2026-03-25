import type { APIRoute } from "astro";
import { createSession, createSessionCookie, verifyPassword } from "../../../lib/server/auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";
import { enforceRateLimit, getClientIp } from "../../../lib/server/rate-limit";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { email, password } = (await context.request.json()) as any;
    if (!email || !password) {
      return json({ error: "Email and password are required." }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = getClientIp(context.request);

    const byIp = await enforceRateLimit(env, {
      scope: "auth.login.ip",
      key: ip,
      limit: 30,
      windowSeconds: 10 * 60
    });
    if (!byIp.ok) {
      return json(
        { error: "Too many login attempts. Please wait and try again." },
        429,
        { "retry-after": String(byIp.retryAfterSeconds) }
      );
    }

    const byEmail = await enforceRateLimit(env, {
      scope: "auth.login.email",
      key: normalizedEmail,
      limit: 12,
      windowSeconds: 15 * 60
    });
    if (!byEmail.ok) {
      return json(
        { error: "Too many login attempts for this account. Please try again later." },
        429,
        { "retry-after": String(byEmail.retryAfterSeconds) }
      );
    }

    const organizer = await env.DB.prepare(
      "SELECT id, name, email, password_hash, password_salt FROM organizers WHERE email = ?"
    )
      .bind(normalizedEmail)
      .first<{
        id: string;
        name: string;
        email: string;
        password_hash: string;
        password_salt: string;
      }>();

    if (!organizer) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const valid = await verifyPassword(
      String(password),
      organizer.password_hash,
      organizer.password_salt
    );
    if (!valid) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const session = await createSession(env, organizer.id);
    const cookie = createSessionCookie(context.request, session.sessionId);

    return json(
      {
        organizer: {
          id: organizer.id,
          name: organizer.name,
          email: organizer.email
        }
      },
      200,
      {
        "set-cookie": cookie
      }
    );
  } catch (error) {
    console.error("login_error", error);
    return json({ error: "Unable to sign in." }, 500);
  }
};
