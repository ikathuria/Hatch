import type { APIRoute } from "astro";
import { getEnv } from "../../../../../lib/server/env";
import { json } from "../../../../../lib/server/responses";
import { getOrganizerFromRequest } from "../../../../../lib/server/auth";
import { getParticipantSessionFromRequest } from "../../../../../lib/server/participant-auth";
import {
  loadLatestParticipantApplication,
  resolvePublishedEventForParticipant
} from "../../../../../lib/server/participant-workspace";
import { normalizeEmail } from "../../../../../lib/server/email";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = String(context.params.slug || "");
    const requestUrl = new URL(context.request.url);
    const organizerId = String(requestUrl.searchParams.get("organizerId") || "").trim();
    const requestedEmail = normalizeEmail(String(requestUrl.searchParams.get("email") || ""));
    const { event, error, status } = await resolvePublishedEventForParticipant(env, slug, organizerId);
    if (!event) {
      return json({ error }, status);
    }

    const participant = await getParticipantSessionFromRequest(context.request, env);
    const organizer = await getOrganizerFromRequest(context.request, env);
    const email =
      requestedEmail ||
      (participant && participant.eventId === event.id ? normalizeEmail(participant.email) : "") ||
      normalizeEmail(String(organizer?.email || ""));

    if (!email) {
      return json({ application: null });
    }

    const application = await loadLatestParticipantApplication(env, event.id, email);
    if (!application) {
      return json({ application: null, email });
    }

    return json({
      email,
      application: {
        id: application.id,
        status: application.status,
        fullName: application.fullName,
        location: application.location,
        teamStatus: application.teamStatus
      }
    });
  } catch {
    return json({ error: "Unable to load participant application status." }, 500);
  }
};
