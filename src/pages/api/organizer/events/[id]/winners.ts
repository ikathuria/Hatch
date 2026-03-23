import type { APIRoute } from "astro";
import { requireOrganizer } from "../../../../../lib/server/auth";
import { json } from "../../../../../lib/server/responses";
import { getEnv } from "../../../../../lib/server/env";
import {
  buildJudgingOverview,
  type EventTieBreakRow,
  type EventWinnerRow,
  type JudgeScoreRow,
  type RubricCriterionRow,
  type RubricRow,
  type SubmissionRow,
  type VoteCountRow
} from "../../../../../lib/server/judging";

const loadEvent = async (env: ReturnType<typeof getEnv>, eventId: string, organizerId: string) =>
  env.DB.prepare(
    `SELECT id, results_status as resultsStatus
     FROM events
     WHERE id = ? AND organizer_id = ?`
  )
    .bind(eventId, organizerId)
    .first<{ id: string; resultsStatus: string }>();

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
      return json({ error: "Results are already published." }, 409);
    }

    const payload = (await context.request.json()) as any;
    const overallWinnerSubmissionId = String(payload.overallWinnerSubmissionId || "").trim();
    const trackWinnersInput = Array.isArray(payload.trackWinners) ? payload.trackWinners : [];
    const note = String(payload.note || "").trim();

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

    const overview = buildJudgingOverview(
      rubric ?? null,
      criteria.results ?? [],
      submissions.results ?? [],
      scores.results ?? [],
      votes.results ?? []
    );

    if (!overallWinnerSubmissionId) {
      return json({ error: "An overall winner is required." }, 400);
    }

    const winnerStatements: D1PreparedStatement[] = [];
    const tieBreakStatements: D1PreparedStatement[] = [];

    const overallWinner = overview.overall.ranking.find(
      (submission) => submission.id === overallWinnerSubmissionId
    );
    if (!overallWinner) {
      return json({ error: "The overall winner must be one of the event submissions." }, 400);
    }

    if (
      overview.overall.tiedSubmissionIds.length > 1 &&
      !overview.overall.tiedSubmissionIds.includes(overallWinnerSubmissionId)
    ) {
      return json(
        { error: "The overall winner must come from the tied top-scoring submissions." },
        400
      );
    }

    winnerStatements.push(
      env.DB.prepare(
        `INSERT INTO event_winners
         (id, event_id, scope, track_name, submission_id, created_by_organizer_id, created_at, updated_at)
         VALUES (?, ?, 'overall', '', ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(event_id, scope, track_name) DO UPDATE SET
           submission_id = excluded.submission_id,
           created_by_organizer_id = excluded.created_by_organizer_id,
           updated_at = datetime('now')`
      ).bind(crypto.randomUUID(), id, overallWinnerSubmissionId, organizer!.id)
    );

    if (overview.overall.tiedSubmissionIds.length > 1) {
      tieBreakStatements.push(
        env.DB.prepare(
          `INSERT INTO event_tie_breaks
           (id, event_id, scope, track_name, submission_id, tied_submission_ids, note, resolved_by_organizer_id, resolved_at)
           VALUES (?, ?, 'overall', '', ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(event_id, scope, track_name) DO UPDATE SET
             submission_id = excluded.submission_id,
             tied_submission_ids = excluded.tied_submission_ids,
             note = excluded.note,
             resolved_by_organizer_id = excluded.resolved_by_organizer_id,
             resolved_at = datetime('now')`
        ).bind(
          crypto.randomUUID(),
          id,
          overallWinnerSubmissionId,
          JSON.stringify(overview.overall.tiedSubmissionIds),
          note || null,
          organizer!.id
        )
      );
    } else {
      tieBreakStatements.push(
        env.DB.prepare("DELETE FROM event_tie_breaks WHERE event_id = ? AND scope = 'overall' AND track_name = ''")
          .bind(id)
      );
    }

    const trackWinners = trackWinnersInput
      .map((entry: any) => ({
        trackName: String(entry?.trackName || entry?.track || "").trim(),
        submissionId: String(entry?.submissionId || "").trim()
      }))
      .filter((entry: any) => entry.trackName && entry.submissionId);

    const trackWinnerMap = new Map<string, string>();
    for (const entry of trackWinners) {
      if (trackWinnerMap.has(entry.trackName)) {
        return json({ error: `Duplicate winner entry for track "${entry.trackName}".` }, 400);
      }
      trackWinnerMap.set(entry.trackName, entry.submissionId);
    }

    for (const track of overview.tracks) {
      const submittedWinnerId = trackWinnerMap.get(track.trackName);
      if (!submittedWinnerId) {
        return json({ error: `Missing winner for track "${track.trackName}".` }, 400);
      }

      const trackWinner = track.ranking.find((submission) => submission.id === submittedWinnerId);
      if (!trackWinner) {
        return json({
          error: `Track winner for "${track.trackName}" must be one of that track's submissions.`
        }, 400);
      }

      if (
        track.tiedSubmissionIds.length > 1 &&
        !track.tiedSubmissionIds.includes(submittedWinnerId)
      ) {
        return json({
          error: `Track "${track.trackName}" is tied. Please select one of the tied submissions.`
        }, 400);
      }

      winnerStatements.push(
        env.DB.prepare(
          `INSERT INTO event_winners
           (id, event_id, scope, track_name, submission_id, created_by_organizer_id, created_at, updated_at)
           VALUES (?, ?, 'track', ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(event_id, scope, track_name) DO UPDATE SET
             submission_id = excluded.submission_id,
             created_by_organizer_id = excluded.created_by_organizer_id,
             updated_at = datetime('now')`
        ).bind(crypto.randomUUID(), id, track.trackName, submittedWinnerId, organizer!.id)
      );

      if (track.tiedSubmissionIds.length > 1) {
        tieBreakStatements.push(
          env.DB.prepare(
            `INSERT INTO event_tie_breaks
             (id, event_id, scope, track_name, submission_id, tied_submission_ids, note, resolved_by_organizer_id, resolved_at)
             VALUES (?, ?, 'track', ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(event_id, scope, track_name) DO UPDATE SET
               submission_id = excluded.submission_id,
               tied_submission_ids = excluded.tied_submission_ids,
               note = excluded.note,
               resolved_by_organizer_id = excluded.resolved_by_organizer_id,
               resolved_at = datetime('now')`
          ).bind(
            crypto.randomUUID(),
            id,
            track.trackName,
            submittedWinnerId,
            JSON.stringify(track.tiedSubmissionIds),
            note || null,
            organizer!.id
          )
        );
      } else {
        tieBreakStatements.push(
          env.DB.prepare(
            "DELETE FROM event_tie_breaks WHERE event_id = ? AND scope = 'track' AND track_name = ?"
          ).bind(id, track.trackName)
        );
      }
    }

    for (const trackName of trackWinnerMap.keys()) {
      if (!overview.tracks.some((track) => track.trackName === trackName)) {
        return json({ error: `Unknown track "${trackName}" in track winners.` }, 400);
      }
    }

    await env.DB.batch([...winnerStatements, ...tieBreakStatements]);

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

    return json({
      winners: winners.results ?? [],
      tieBreaks: tieBreaks.results ?? []
    });
  } catch {
    return json({ error: "Unable to save winners." }, 500);
  }
};
