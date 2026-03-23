import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../lib/server/auth";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import { buildJudgingOverview, type JudgeScoreRow, type RubricCriterionRow, type RubricRow, type SubmissionRow, type VoteCountRow, type EventWinnerRow, type EventTieBreakRow } from "../../../../../lib/server/judging";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string, organizerId: string) =>
  env.DB.prepare(
    `SELECT id, results_status as resultsStatus, results_published_at as resultsPublishedAt
     FROM events
     WHERE id = ? AND organizer_id = ?`
  )
    .bind(eventId, organizerId)
    .first<{ id: string; resultsStatus: string; resultsPublishedAt: string | null }>();

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const { organizer, response } = await requireOrganizer(context.request, env);
    if (response) return response;

    const id = context.params.id ? String(context.params.id) : "";
    if (!id) return json({ error: "Missing event id." }, 400);

    const event = await loadEvent(env, id, organizer!.id);
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
       WHERE event_id = ?`
    )
      .bind(id)
      .all<JudgeScoreRow>();

    const votes = await env.DB.prepare(
      `SELECT submission_id as submissionId, COUNT(*) as voteCount
       FROM submission_votes
       WHERE event_id = ?
       GROUP BY submission_id`
    )
      .bind(id)
      .all<VoteCountRow>();

    const winners = await env.DB.prepare(
      `SELECT scope, track_name as trackName, submission_id as submissionId
       FROM event_winners
       WHERE event_id = ?`
    )
      .bind(id)
      .all<EventWinnerRow>();

    const tieBreaks = await env.DB.prepare(
      `SELECT scope, track_name as trackName, submission_id as submissionId, tied_submission_ids as tiedSubmissionIds, note
       FROM event_tie_breaks
       WHERE event_id = ?`
    )
      .bind(id)
      .all<EventTieBreakRow>();

    const overview = buildJudgingOverview(
      rubric ?? null,
      criteria.results ?? [],
      submissions.results ?? [],
      scores.results ?? [],
      votes.results ?? []
    );

    const unresolvedTies = [
      ...(overview.overall.tiedSubmissionIds.length > 1
        ? [
            {
              scope: "overall",
              trackName: "",
              tiedSubmissionIds: overview.overall.tiedSubmissionIds
            }
          ]
        : []),
      ...overview.tracks
        .filter((track) => track.tiedSubmissionIds.length > 1)
        .map((track) => ({
          scope: "track",
          trackName: track.trackName,
          tiedSubmissionIds: track.tiedSubmissionIds
        }))
    ];

    return json({
      event,
      rubric: overview.rubric,
      criteria: overview.criteria,
      submissions: overview.submissions,
      rankings: {
        overall: overview.overall,
        tracks: overview.tracks
      },
      winners: winners.results ?? [],
      tieBreaks: tieBreaks.results ?? [],
      unresolvedTies
    });
  } catch {
    return json({ error: "Unable to load scoring overview." }, 500);
  }
};
