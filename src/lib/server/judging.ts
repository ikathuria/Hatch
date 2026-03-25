export interface RubricCriterionRow {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  weight: number;
  sortOrder: number;
}

export interface RubricRow {
  id: string;
  eventId: string;
  title: string | null;
  description: string | null;
  minScore: number;
  maxScore: number;
}

export interface SubmissionRow {
  id: string;
  createdAt: string;
  teamName: string;
  projectName: string;
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  deckUrl: string | null;
  track: string | null;
  members: string | null;
  contactEmail: string;
}

export interface JudgeScoreRow {
  submissionId: string;
  rubricCriterionId: string;
  score: number;
  comment: string | null;
  judgeLinkId: string;
}

export interface VoteCountRow {
  submissionId: string;
  voteCount: number;
}

export interface EventWinnerRow {
  scope: string;
  trackName: string;
  submissionId: string;
}

export interface EventTieBreakRow {
  scope: string;
  trackName: string;
  submissionId: string;
  tiedSubmissionIds: string;
  note: string | null;
}

export interface ScoreSummary {
  criterionId: string;
  averageScore: number;
  weight: number;
  scoreCount: number;
}

export interface SubmissionSummary {
  id: string;
  createdAt: string;
  teamName: string;
  projectName: string;
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  deckUrl: string | null;
  track: string;
  members: string | null;
  contactEmail: string;
  totalScore: number;
  voteCount: number;
  scoreCount: number;
  criterionScores: ScoreSummary[];
}

export interface RankedScopeSummary {
  scope: "overall" | "track";
  trackName: string;
  ranking: SubmissionSummary[];
  topScore: number | null;
  tiedSubmissionIds: string[];
}

export interface JudgingOverview {
  rubric: RubricRow | null;
  criteria: RubricCriterionRow[];
  submissions: SubmissionSummary[];
  overall: RankedScopeSummary;
  tracks: RankedScopeSummary[];
}

const EPSILON = 1e-9;

const normalizeTrackName = (value: string | null | undefined) => (value ?? "").trim();

const scoreMapKey = (submissionId: string, criterionId: string) => `${submissionId}::${criterionId}`;

const groupScores = (scores: JudgeScoreRow[]) => {
  const grouped = new Map<
    string,
    {
      sum: number;
      count: number;
    }
  >();

  for (const score of scores) {
    const key = scoreMapKey(score.submissionId, score.rubricCriterionId);
    const current = grouped.get(key) ?? { sum: 0, count: 0 };
    current.sum += Number(score.score) || 0;
    current.count += 1;
    grouped.set(key, current);
  }

  return grouped;
};

const sortSubmissions = (a: SubmissionSummary, b: SubmissionSummary) => {
  if (Math.abs(b.totalScore - a.totalScore) > EPSILON) return b.totalScore - a.totalScore;
  return a.createdAt.localeCompare(b.createdAt);
};

const scoreSummary = (
  submission: SubmissionRow,
  criteria: RubricCriterionRow[],
  scores: Map<string, { sum: number; count: number }>,
  voteCount: number
): SubmissionSummary => {
  const criterionScores: ScoreSummary[] = [];
  let total = 0;
  let scoreCount = 0;

  for (const criterion of criteria) {
    const key = scoreMapKey(submission.id, criterion.id);
    const value = scores.get(key) ?? { sum: 0, count: 0 };
    const averageScore = value.count > 0 ? value.sum / value.count : 0;
    criterionScores.push({
      criterionId: criterion.id,
      averageScore: Number(averageScore.toFixed(4)),
      weight: Number(criterion.weight),
      scoreCount: value.count
    });
    total += averageScore * Number(criterion.weight);
    scoreCount += value.count;
  }

  return {
    id: submission.id,
    createdAt: submission.createdAt,
    teamName: submission.teamName,
    projectName: submission.projectName,
    description: submission.description,
    repoUrl: submission.repoUrl,
    demoUrl: submission.demoUrl,
    deckUrl: submission.deckUrl,
    track: normalizeTrackName(submission.track),
    members: submission.members,
    contactEmail: submission.contactEmail,
    totalScore: Number(total.toFixed(4)),
    voteCount,
    scoreCount,
    criterionScores
  };
};

const buildRankedScope = (
  scope: "overall" | "track",
  trackName: string,
  submissions: SubmissionSummary[]
): RankedScopeSummary => {
  const ranking = [...submissions].sort(sortSubmissions);
  const topScore = ranking.length > 0 ? ranking[0].totalScore : null;
  const tiedSubmissionIds =
    topScore === null
      ? []
      : ranking
          .filter((submission) => Math.abs(submission.totalScore - topScore) <= EPSILON)
          .map((submission) => submission.id);

  return { scope, trackName, ranking, topScore, tiedSubmissionIds };
};

export const buildJudgingOverview = (
  rubric: RubricRow | null,
  criteria: RubricCriterionRow[],
  submissions: SubmissionRow[],
  scores: JudgeScoreRow[],
  votes: VoteCountRow[]
): JudgingOverview => {
  const scoreGroups = groupScores(scores);
  const voteCounts = new Map(votes.map((row) => [row.submissionId, Number(row.voteCount) || 0]));

  const summaries = submissions.map((submission) =>
    scoreSummary(submission, criteria, scoreGroups, voteCounts.get(submission.id) ?? 0)
  );

  const overall = buildRankedScope("overall", "", summaries);
  const trackBuckets = new Map<string, SubmissionSummary[]>();

  for (const summary of summaries) {
    const trackName = summary.track;
    if (!trackName) continue;
    const bucket = trackBuckets.get(trackName) ?? [];
    bucket.push(summary);
    trackBuckets.set(trackName, bucket);
  }

  const tracks = Array.from(trackBuckets.entries())
    .map(([trackName, bucket]) => buildRankedScope("track", trackName, bucket))
    .sort((a, b) => a.trackName.localeCompare(b.trackName));

  return {
    rubric,
    criteria: [...criteria].sort((a, b) => a.sortOrder - b.sortOrder),
    submissions: summaries.sort(sortSubmissions),
    overall,
    tracks
  };
};

export const scopeKey = (scope: "overall" | "track", trackName = "") =>
  `${scope}:${normalizeTrackName(trackName)}`;

export const getWinnerScope = (row: { scope: string; trackName: string }) =>
  scopeKey(row.scope as "overall" | "track", row.trackName);

export const isTieResolved = (
  scope: RankedScopeSummary,
  winnerSubmissionId: string | null | undefined
) =>
  Boolean(
    winnerSubmissionId &&
      scope.tiedSubmissionIds.includes(winnerSubmissionId) &&
      scope.tiedSubmissionIds.length > 1
  );

export const findSubmissionById = (submissions: SubmissionSummary[], submissionId: string) =>
  submissions.find((submission) => submission.id === submissionId) ?? null;

export const hasWinnerScopeTie = (scope: RankedScopeSummary) => scope.tiedSubmissionIds.length > 1;

export interface SuggestedWinners {
  overall: string | null;
  /** Track name → submission id when there is a single top score; null when tied or empty track. */
  tracks: Record<string, string | null>;
}

export const computeSuggestedWinners = (overview: JudgingOverview): SuggestedWinners => {
  const overall =
    overview.overall.tiedSubmissionIds.length === 1 ? overview.overall.tiedSubmissionIds[0]! : null;
  const tracks: Record<string, string | null> = {};
  for (const t of overview.tracks) {
    tracks[t.trackName] = t.tiedSubmissionIds.length === 1 ? t.tiedSubmissionIds[0]! : null;
  }
  return { overall, tracks };
};

/** True when every scope has a unique top score so winners can follow the leaderboard without a tie-break. */
export const scoreBasedWinnersCanApply = (overview: JudgingOverview, suggested: SuggestedWinners): boolean =>
  Boolean(suggested.overall) && overview.tracks.every((t) => t.tiedSubmissionIds.length === 1);

export const winnersMatchSuggested = (
  winners: Array<{ scope: string; trackName?: string; submissionId: string }>,
  suggested: SuggestedWinners
): boolean => {
  if (!suggested.overall) return false;
  const overallRow = winners.find((w) => w.scope === "overall");
  if (!overallRow || overallRow.submissionId !== suggested.overall) return false;
  for (const [trackName, sid] of Object.entries(suggested.tracks)) {
    if (!sid) return false;
    const row = winners.find((w) => w.scope === "track" && w.trackName === trackName);
    if (!row || row.submissionId !== sid) return false;
  }
  return true;
};
