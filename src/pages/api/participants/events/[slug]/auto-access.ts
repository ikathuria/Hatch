import type { APIRoute } from "astro";
import { getEnv } from "../../../../../lib/server/env";
import { json } from "../../../../../lib/server/responses";
import { getOrganizerFromRequest } from "../../../../../lib/server/auth";
import {
  createParticipantSession,
  createParticipantSessionCookie,
  getParticipantSessionFromRequest
} from "../../../../../lib/server/participant-auth";
import {
  getParticipantAccessState,
  resolvePublishedEventForParticipant
} from "../../../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../../../lib/server/email";

export const POST: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = String(context.params.slug || "");
    const organizerId = String(new URL(context.request.url).searchParams.get("organizerId") || "").trim();
    const { event, error, status } = await resolvePublishedEventForParticipant(env, slug, organizerId);
    if (!event) {
      return json({ error }, status);
    }

    const participant = await getParticipantSessionFromRequest(context.request, env);
    if (participant && participant.eventId === event.id) {
      return json({
        ok: true,
        source: "participant-session",
        participant: {
          eventId: participant.eventId,
          email: normalizeEmail(participant.email)
        }
      });
    }

    const organizer = await getOrganizerFromRequest(context.request, env);
    if (!organizer?.email) {
      return json({ ok: false, source: "none" });
    }

    const email = normalizeEmail(organizer.email);
    const access = await getParticipantAccessState(env, event.id, email);
    if (!access.allowed) {
      return json({ ok: false, source: access.reason, email });
    }

    const session = await createParticipantSession(env, event.id, email);
    return json(
      {
        ok: true,
        source: "organizer-session",
        participant: {
          eventId: event.id,
          email
        }
      },
      200,
      {
        "set-cookie": createParticipantSessionCookie(context.request, session.token)
      }
    );
  } catch {
    return json({ error: "Unable to open attendee access automatically." }, 500);
  }
};
