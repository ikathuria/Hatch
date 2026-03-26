import type { APIRoute } from "astro";
import { json } from "../../../lib/server/responses";
import { getEnv } from "../../../lib/server/env";
import { getOrganizerFromRequest } from "../../../lib/server/auth";
import {
  buildJudgingOverview,
  type EventTieBreakRow,
  type EventWinnerRow,
  type JudgeScoreRow,
  type RubricCriterionRow,
  type RubricRow,
  type SubmissionRow,
  type VoteCountRow
} from "../../../lib/server/judging";
import {
  parseApplicationFormFields,
  parseParticipantLocations
} from "../../../lib/server/application-config";

export const GET: APIRoute = async (context) => {
  try {
    const env = getEnv(context.locals);
    const slug = context.params.slug ? String(context.params.slug) : "";
    if (!slug) {
      return json({ error: "Missing slug." }, 400);
    }
    const organizer = await getOrganizerFromRequest(context.request, env);
    const requestUrl = new URL(context.request.url);
    const organizerId = String(requestUrl.searchParams.get("organizerId") || "").trim();

    let event: Record<string, unknown> | null = null;
    if (organizerId) {
      event = await env.DB.prepare(
        `SELECT events.id, events.organizer_id as organizerId, events.slug, events.title, events.tagline, events.description, events.start_date as startDate, events.end_date as endDate,
          location, participant_location_options as participantLocationOptions, application_form_fields as applicationFormFieldsRaw, mode, organization_name as organizationName, website_url as websiteUrl,
          twitter_url as twitterUrl, discord_url as discordUrl, max_participants as maxParticipants,
          application_deadline as applicationDeadline, theme,
          banner_url as bannerUrl, results_status as resultsStatus,
          results_published_at as resultsPublishedAt, is_published as isPublished,
          organizers.email as organizerEmail
         FROM events
         JOIN organizers ON organizers.id = events.organizer_id
         WHERE events.slug = ?
           AND events.organizer_id = ?
           AND (events.is_published = 1 OR events.organizer_id = ?)`
      )
        .bind(slug, organizerId, organizer?.id ?? "")
        .first<Record<string, unknown>>();
    } else {
      const matches = await env.DB.prepare(
        `SELECT events.id, events.organizer_id as organizerId, events.slug, events.title, events.tagline, events.description, events.start_date as startDate, events.end_date as endDate,
          location, participant_location_options as participantLocationOptions, application_form_fields as applicationFormFieldsRaw, mode, organization_name as organizationName, website_url as websiteUrl,
          twitter_url as twitterUrl, discord_url as discordUrl, max_participants as maxParticipants,
          application_deadline as applicationDeadline, theme,
          banner_url as bannerUrl, results_status as resultsStatus,
          results_published_at as resultsPublishedAt, is_published as isPublished,
          organizers.email as organizerEmail
         FROM events
         JOIN organizers ON organizers.id = events.organizer_id
         WHERE events.slug = ?
           AND (events.is_published = 1 OR events.organizer_id = ?)
         ORDER BY events.is_published DESC, events.created_at DESC`
      )
        .bind(slug, organizer?.id ?? "")
        .all<Record<string, unknown>>();

      const rows = matches.results ?? [];
      if (rows.length > 1) {
        return json(
          {
            error:
              "Multiple events share this slug. Use /events/<organizer-id>/<event-slug>.",
            requiresOrganizerId: true
          },
          409
        );
      }
      event = rows[0] ?? null;
    }

    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    const tracks = await env.DB.prepare(
      "SELECT name, description, prize FROM event_tracks WHERE event_id = ?"
    )
      .bind(event.id)
      .all();

    const faqs = await env.DB.prepare(
      "SELECT question, answer FROM event_faqs WHERE event_id = ?"
    )
      .bind(event.id)
      .all();

    const resultsPublished = event.resultsStatus === "published" || Boolean(event.resultsPublishedAt);
    let gallery: Array<Record<string, unknown>> = [];
    let winners: Record<string, unknown> = { overall: null, tracks: [] };

    if (resultsPublished) {
      const rubric = await env.DB.prepare(
        `SELECT id, event_id as eventId, title, description, min_score as minScore, max_score as maxScore
         FROM event_rubrics
         WHERE event_id = ?`
      )
        .bind(event.id)
        .first<RubricRow>();

      const criteria = await env.DB.prepare(
        `SELECT id, event_id as eventId, name, description, weight, sort_order as sortOrder
         FROM event_rubric_criteria
         WHERE event_id = ?
         ORDER BY sort_order ASC, created_at ASC`
      )
        .bind(event.id)
        .all<RubricCriterionRow>();

      const submissions = await env.DB.prepare(
        `SELECT id, created_at as createdAt, team_name as teamName, project_name as projectName,
          description, repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
          track, members, contact_email as contactEmail
         FROM submissions
         WHERE event_id = ?
         ORDER BY created_at DESC`
      )
        .bind(event.id)
        .all<SubmissionRow>();

      const scores = await env.DB.prepare(
        `SELECT submission_id as submissionId, rubric_criterion_id as rubricCriterionId,
          score, comment, judge_link_id as judgeLinkId
         FROM judge_scores
         WHERE event_id = ?`
      )
        .bind(event.id)
        .all<JudgeScoreRow>();

      const votes = await env.DB.prepare(
        `SELECT submission_id as submissionId, COUNT(*) as voteCount
         FROM submission_votes
         WHERE event_id = ?
         GROUP BY submission_id`
      )
        .bind(event.id)
        .all<VoteCountRow>();

      const winnerRows = await env.DB.prepare(
        `SELECT scope, track_name as trackName, submission_id as submissionId
         FROM event_winners
         WHERE event_id = ?`
      )
        .bind(event.id)
        .all<EventWinnerRow>();

      const tieBreakRows = await env.DB.prepare(
        `SELECT scope, track_name as trackName, submission_id as submissionId, tied_submission_ids as tiedSubmissionIds, note
         FROM event_tie_breaks
         WHERE event_id = ?`
      )
        .bind(event.id)
        .all<EventTieBreakRow>();

      const overview = buildJudgingOverview(
        rubric ?? null,
        criteria.results ?? [],
        submissions.results ?? [],
        scores.results ?? [],
        votes.results ?? []
      );

      const submissionLookup = new Map(overview.submissions.map((submission) => [submission.id, submission]));
      const winnerScopes = new Map<string, string[]>();

      for (const winner of winnerRows.results ?? []) {
        const scopes = winnerScopes.get(winner.submissionId) ?? [];
        scopes.push(winner.scope === "overall" ? "overall" : `track:${winner.trackName}`);
        winnerScopes.set(winner.submissionId, scopes);
      }

      const maxVotes = overview.submissions.reduce(
        (best, submission) => Math.max(best, Number(submission.voteCount || 0)),
        0
      );

      gallery = overview.submissions.map((submission) => ({
        ...submission,
        isWinner: winnerScopes.has(submission.id),
        winnerScopes: winnerScopes.get(submission.id) ?? [],
        isPopularityWinner: maxVotes > 0 && Number(submission.voteCount || 0) === maxVotes
      }));

      const overallWinnerRow = (winnerRows.results ?? []).find((row) => row.scope === "overall");
      const trackWinnerRows = (winnerRows.results ?? []).filter((row) => row.scope === "track");
      const overallWinner = overallWinnerRow
        ? {
            submissionId: overallWinnerRow.submissionId,
            submission: submissionLookup.get(overallWinnerRow.submissionId) ?? null
          }
        : null;
      const trackWinners = trackWinnerRows.map((row) => ({
        trackName: row.trackName,
        submissionId: row.submissionId,
        submission: submissionLookup.get(row.submissionId) ?? null
      }));

      winners = {
        overall: overallWinner,
        tracks: trackWinners,
        tieBreaks: tieBreakRows.results ?? []
      };
    }

    return json({
      event: {
        ...event,
        participantLocations: parseParticipantLocations(event.participantLocationOptions),
        applicationFormFields: parseApplicationFormFields(event.applicationFormFieldsRaw)
      },
      tracks: tracks.results ?? [],
      faqs: faqs.results ?? [],
      resultsPublished,
      isPreview: Number(event.isPublished ?? 0) !== 1,
      gallery: resultsPublished ? gallery : undefined,
      winners: resultsPublished ? winners : undefined
    });
  } catch (error) {
    return json({ error: "Unable to load event." }, 500);
  }
};
