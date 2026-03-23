import type { APIRoute } from "astro";
import { hashPassword, createSession, createSessionCookie } from "../../../lib/server/auth";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";
import { emailPattern } from "../../../lib/server/validation";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const payload = await context.request.json();
    const { name, email, password } = payload as any;
    if (!name || !email || !password) {
      return json({ error: "Name, email, and password are required." }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      return json({ error: "Please provide a valid email." }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM organizers WHERE email = ?")
      .bind(normalizedEmail)
      .first();
    if (existing) {
      return json({ error: "An account already exists for that email." }, 409);
    }

    const organizerId = crypto.randomUUID();
    const { hash, salt } = await hashPassword(String(password));
    await env.DB.prepare(
      "INSERT INTO organizers (id, created_at, name, email, password_hash, password_salt) VALUES (?, datetime('now'), ?, ?, ?, ?)"
    )
      .bind(organizerId, String(name).trim(), normalizedEmail, hash, salt)
      .run();

    const session = await createSession(env, organizerId);
    const cookie = createSessionCookie(context.request, session.sessionId);

    return json(
      {
        organizer: { id: organizerId, name: String(name).trim(), email: normalizedEmail }
      },
      201,
      {
        "set-cookie": cookie
      }
    );
  } catch {
    return json({ error: "Unable to create account." }, 500);
  }
};
