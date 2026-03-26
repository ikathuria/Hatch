import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../../lib/server/auth";
import { getEnv } from "../../../../../../lib/server/env";
import { json } from "../../../../../../lib/server/responses";
import {
  parseApplicationAnswers,
  parseApplicationFormFields
} from "../../../../../../lib/server/application-config";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = String(context.params.id || "").trim();
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await env.DB.prepare(
      `SELECT id, title, application_form_fields as applicationFormFieldsRaw
       FROM events
       WHERE id = ? AND organizer_id = ?`
    )
      .bind(id, organizer?.id)
      .first<{ id: string; title: string; applicationFormFieldsRaw: string | null }>();

    if (!event) return json({ error: "Event not found." }, 404);

    const fields = parseApplicationFormFields(event.applicationFormFieldsRaw);
    const fieldLabels = new Map(fields.map((field) => [field.id, field.label]));
    const applications = await env.DB.prepare(
      `SELECT id, created_at as createdAt, full_name as fullName, email, location,
        team_status as teamStatus, linkedin_url as linkedinUrl, github_url as githubUrl,
        status, custom_answers as customAnswers, reviewed_at as reviewedAt
       FROM applications
       WHERE event_id = ?
       ORDER BY
         CASE status
           WHEN 'pending' THEN 0
           WHEN 'approved' THEN 1
           WHEN 'rejected' THEN 2
           ELSE 3
         END,
         created_at DESC`
    )
      .bind(id)
      .all<{
        id: string;
        createdAt: string;
        fullName: string | null;
        email: string;
        location: string | null;
        teamStatus: string | null;
        linkedinUrl: string | null;
        githubUrl: string | null;
        status: string | null;
        customAnswers: string | null;
        reviewedAt: string | null;
      }>();

    return json({
      event: {
        id: event.id,
        title: event.title,
        applicationFormFields: fields
      },
      applications: (applications.results ?? []).map((application) => ({
        id: application.id,
        createdAt: application.createdAt,
        fullName: String(application.fullName || "").trim(),
        email: String(application.email || "").trim(),
        location: String(application.location || "").trim(),
        teamStatus: String(application.teamStatus || "").trim(),
        linkedinUrl: String(application.linkedinUrl || "").trim(),
        githubUrl: String(application.githubUrl || "").trim(),
        status: String(application.status || "pending").trim() || "pending",
        reviewedAt: application.reviewedAt,
        customAnswers: Object.fromEntries(
          Object.entries(parseApplicationAnswers(application.customAnswers)).map(([fieldId, value]) => [
            fieldLabels.get(fieldId) || fieldId,
            value
          ])
        )
      }))
    });
  } catch {
    return json({ error: "Unable to load applications." }, 500);
  }
};
