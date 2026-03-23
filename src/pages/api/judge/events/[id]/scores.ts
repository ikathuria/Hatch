import type { APIRoute } from "astro";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { requireJudgeSession } from "../../../../../lib/server/judge-auth";
import { buildJudgingOverview, type JudgeScoreRow, type RubricCriterionRow, type RubricRow, type SubmissionRow, type VoteCountRow } from "../../../../../lib/server/judging";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string) =>
  env.DB.prepare(
    `SELECT id, results_status as resultsStatus
     FROM events
     WHERE id = ?`
  )
    .bind(eventId)
    .first<{ id: string; resultsStatus: string }>();

export const PUT: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const { judge, response } = await requireJudgeSession(context.request, env, id);
    if (response) return response;

    const event = await loadEvent(env, id);
    if (!event) return json({ error: "Event not found." }, 404);
    if (event.resultsStatus === "published") {
      return json({ error: "Results are already published and scores are locked." }, 409);
    }

    const rubric = await env.DB.prepare(
      `SELECT id, event_id as eventId, title, description, min_score as minScore, max_score as maxScore
       FROM event_rubrics
       WHERE event_id = ?`
    )
      .bind(id)
      .first<RubricRow>();

    const criteria = await env.DB.prepare(
      `SELECT id, event_id as eventId, name, description, weight, sort_order as sortOrder
       FROM event_rubric_criteria
       WHERE event_id = ?
       ORDER BY sort_order ASC, created_at ASC`
    )
      .bind(id)
      .all<RubricCriterionRow>();

    const submissions = await env.DB.prepare(
      `SELECT id, created_at as createdAt, team_name as teamName, project_name as projectName,
        description, repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
        track, members, contact_email as contactEmail
       FROM submissions
       WHERE event_id = ?`
    )
      .bind(id)
      .all<SubmissionRow>();

    const currentScores = await env.DB.prepare(
      `SELECT submission_id as submissionId, rubric_criterion_id as rubricCriterionId,
        score, comment, judge_link_id as judgeLinkId
       FROM judge_scores
       WHERE event_id = ? AND judge_link_id = ?`
    )
      .bind(id, judge!.judgeLinkId)
      .all<JudgeScoreRow>();

    const votes = await env.DB.prepare(
      `SELECT submission_id as submissionId, COUNT(*) as voteCount
       FROM submission_votes
       WHERE event_id = ?
       GROUP BY submission_id`
    )
      .bind(id)
      .all<VoteCountRow>();

    const overview = buildJudgingOverview(
      rubric ?? null,
      criteria.results ?? [],
      submissions.results ?? [],
      currentScores.results ?? [],
      votes.results ?? []
    );

    const payload = (await context.request.json()) as any;
    const entries = Array.isArray(payload.scores)
      ? payload.scores
      : Array.isArray(payload.entries)
        ? payload.entries
        : payload.submissionId && payload.criterionId
          ? [payload]
          : [];

    if (entries.length === 0) {
      return json({ error: "At least one score entry is required." }, 400);
    }

    if (!overview.rubric || overview.criteria.length === 0) {
      return json({ error: "This event does not have a rubric yet." }, 400);
    }

    const submissionMap = new Map(overview.submissions.map((submission) => [submission.id, submission]));
    const criterionMap = new Map(overview.criteria.map((criterion) => [criterion.id, criterion]));

    const statements: D1PreparedStatement[] = [];
    for (const entry of entries) {
      const submissionId = String(entry?.submissionId || "").trim();
      const criterionId = String(entry?.criterionId || entry?.rubricCriterionId || "").trim();
      const score = Number.parseInt(String(entry?.score ?? ""), 10);
      const comment = String(entry?.comment || "").trim();

      if (!submissionId || !criterionId || !Number.isFinite(score)) {
        return json({ error: "Each score entry needs a submission, criterion, and numeric score." }, 400);
      }

      if (!submissionMap.has(submissionId)) {
        return json({ error: "One of the submissions does not belong to this event." }, 400);
      }

      const criterion = criterionMap.get(criterionId);
      if (!criterion) {
        return json({ error: "One of the criteria does not belong to this event." }, 400);
      }

      if (score < Number(overview.rubric.minScore) || score > Number(overview.rubric.maxScore)) {
        return json(
          {
            error: `Scores must be between ${overview.rubric.minScore} and ${overview.rubric.maxScore}.`
          },
          400
        );
      }

      statements.push(
        env.DB.prepare(
          `INSERT INTO judge_scores
           (id, event_id, submission_id, rubric_criterion_id, judge_link_id, score, comment, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(judge_link_id, submission_id, rubric_criterion_id) DO UPDATE SET
             score = excluded.score,
             comment = excluded.comment,
             updated_at = datetime('now')`
        ).bind(
          crypto.randomUUID(),
          id,
          submissionId,
          criterionId,
          judge!.judgeLinkId,
          score,
          comment || null
        )
      );
    }

    await env.DB.batch(statements);

    const updatedScores = await env.DB.prepare(
      `SELECT submission_id as submissionId, rubric_criterion_id as rubricCriterionId,
        score, comment, judge_link_id as judgeLinkId
       FROM judge_scores
       WHERE event_id = ? AND judge_link_id = ?`
    )
      .bind(id, judge!.judgeLinkId)
      .all<JudgeScoreRow>();

    return json({
      ok: true,
      judgeScores: updatedScores.results ?? []
    });
  } catch {
    return json({ error: "Unable to save scores." }, 500);
  }
};
