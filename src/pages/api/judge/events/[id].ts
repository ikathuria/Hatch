import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/responses";
import { getEnv } from "../../../../lib/server/env";
import { requireJudgeSession } from "../../../../lib/server/judge-auth";
import { buildJudgingOverview, type JudgeScoreRow, type RubricCriterionRow, type RubricRow, type SubmissionRow, type VoteCountRow } from "../../../../lib/server/judging";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string) =>
  env.DB.prepare(
    `SELECT id, slug, title, results_status as resultsStatus, results_published_at as resultsPublishedAt
     FROM events
     WHERE id = ?`
  )
    .bind(eventId)
    .first<{ id: string; slug: string; title: string; resultsStatus: string; resultsPublishedAt: string | null }>();

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const { judge, response } = await requireJudgeSession(context.request, env, id);
    if (response) return response;

    const event = await loadEvent(env, id);
    if (!event) return json({ error: "Event not found." }, 404);

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
       WHERE event_id = ?
       ORDER BY created_at DESC`
    )
      .bind(id)
      .all<SubmissionRow>();

    const scores = await env.DB.prepare(
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
      scores.results ?? [],
      votes.results ?? []
    );

    return json({
      event,
      rubric: overview.rubric,
      criteria: overview.criteria,
      submissions: overview.submissions,
      judgeScores: scores.results ?? []
    });
  } catch {
    return json({ error: "Unable to load judge workspace." }, 500);
  }
};
