import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../lib/server/auth";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string, organizerId: string) =>
  env.DB.prepare(
    `SELECT id, results_status as resultsStatus
     FROM events
     WHERE id = ? AND organizer_id = ?`
  )
    .bind(eventId, organizerId)
    .first<{ id: string; resultsStatus: string }>();

const loadRubric = async (env: ReturnType<typeof getEnv>, eventId: string) => {
  const rubric = await env.DB.prepare(
    `SELECT id, event_id as eventId, title, description, min_score as minScore, max_score as maxScore
     FROM event_rubrics
     WHERE event_id = ?`
  )
    .bind(eventId)
    .first<{
      id: string;
      eventId: string;
      title: string | null;
      description: string | null;
      minScore: number;
      maxScore: number;
    }>();

  const criteria = await env.DB.prepare(
    `SELECT id, event_id as eventId, name, description, weight, sort_order as sortOrder
     FROM event_rubric_criteria
     WHERE event_id = ?
     ORDER BY sort_order ASC, created_at ASC`
  )
    .bind(eventId)
    .all<{
      id: string;
      eventId: string;
      name: string;
      description: string | null;
      weight: number;
      sortOrder: number;
    }>();

  return {
    rubric,
    criteria: criteria.results ?? []
  };
};

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await loadEvent(env, id, organizer!.id);
    if (!event) return json({ error: "Event not found." }, 404);

    const rubric = await loadRubric(env, id);
    return json(rubric);
  } catch {
    return json({ error: "Unable to load rubric." }, 500);
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await loadEvent(env, id, organizer!.id);
    if (!event) return json({ error: "Event not found." }, 404);
    if (event.resultsStatus === "published") {
      return json({ error: "Results are already published and the rubric is locked." }, 409);
    }

    const payload = (await context.request.json()) as any;
    const title = String(payload.title || "").trim();
    const description = String(payload.description || "").trim();
    const minScore = Number.parseInt(String(payload.minScore ?? 1), 10);
    const maxScore = Number.parseInt(String(payload.maxScore ?? 10), 10);
    const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];

    if (!Number.isFinite(minScore) || !Number.isFinite(maxScore) || minScore > maxScore) {
      return json({ error: "Rubric score range is invalid." }, 400);
    }

    const criteria = criteriaInput
      .map((entry: any, index: number) => {
        const name = String(entry?.name || "").trim();
        if (!name) return null;
        const weight = Number(entry?.weight ?? 1);
        const sortOrderRaw = Number.parseInt(String(entry?.sortOrder ?? index), 10);
        if (!Number.isFinite(weight) || weight <= 0) {
          return { error: "Criteria weights must be positive numbers." };
        }
        return {
          id: crypto.randomUUID(),
          name,
          description: String(entry?.description || "").trim(),
          weight,
          sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : index
        };
      })
      .filter(Boolean);

    const invalidCriterion = criteria.find((criterion: any) => criterion.error);
    if (invalidCriterion) {
      return json({ error: invalidCriterion.error }, 400);
    }

    const rubricId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO event_rubrics (id, event_id, title, description, min_score, max_score, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(event_id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           min_score = excluded.min_score,
           max_score = excluded.max_score,
           updated_at = datetime('now')`
      ).bind(rubricId, id, title || null, description || null, minScore, maxScore),
      env.DB.prepare("DELETE FROM event_rubric_criteria WHERE event_id = ?").bind(id),
      ...criteria.map((criterion: any) =>
        env.DB.prepare(
          `INSERT INTO event_rubric_criteria
           (id, event_id, name, description, weight, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(
          criterion.id,
          id,
          criterion.name,
          criterion.description || null,
          criterion.weight,
          criterion.sortOrder
        )
      )
    ]);

    const saved = await loadRubric(env, id);
    return json(saved);
  } catch {
    return json({ error: "Unable to save rubric." }, 500);
  }
};
