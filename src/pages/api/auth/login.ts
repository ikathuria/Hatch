import type { APIRoute } from "astro";
import { createSession, createSessionCookie, verifyPassword } from "../../../lib/server/auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { email, password } = (await context.request.json()) as any;
    if (!email || !password) {
      return json({ error: "Email and password are required." }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
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
