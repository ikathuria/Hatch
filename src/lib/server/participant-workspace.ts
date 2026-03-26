import { extractEmails, normalizeEmail } from "./email";
import { parseApplicationAnswers } from "./application-config";
import type { Env } from "./types";

export interface ResolvedEvent {
  id: string;
  slug: string;
  organizerId: string;
  title: string;
  description: string | null;
  tagline: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  mode: string | null;
  applicationDeadline: string | null;
  websiteUrl: string | null;
  twitterUrl: string | null;
  discordUrl: string | null;
  organizationName: string | null;
}

export interface ParticipantTeamMember {
  email: string;
  displayName: string;
}

export interface ParticipantTeamRecord {
  id: string;
  name: string;
  joinCode: string;
  createdByEmail: string;
  members: ParticipantTeamMember[];
}

export interface TeamDirectoryEntry {
  id: string;
  name: string;
  memberCount: number;
  members: ParticipantTeamMember[];
}

export interface ParticipantSubmissionRecord {
  id: string;
  projectName: string;
  description: string;
  track: string;
  repoUrl: string | null;
  demoUrl: string | null;
  deckUrl: string | null;
  createdAt: string;
}

export interface ParticipantApplicationRecord {
  id: string;
  email: string;
  fullName: string;
  location: string;
  teamStatus: string;
  linkedinUrl: string;
  githubUrl: string;
  status: string;
  customAnswers: Record<string, string>;
}

const fallbackDisplayName = (email: string) => {
  const local = String(email || "").split("@")[0] || "Builder";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const resolvePublishedEventForParticipant = async (
  env: Env,
  slug: string,
  organizerId = ""
) => {
  if (!slug) {
    return { event: null as ResolvedEvent | null, error: "Missing event.", status: 400 };
  }

  let event: ResolvedEvent | null = null;
  if (organizerId) {
    event = await env.DB.prepare(
      `SELECT id, slug, organizer_id as organizerId, title, description, tagline,
        start_date as startDate, end_date as endDate, location, mode,
        application_deadline as applicationDeadline, website_url as websiteUrl,
        twitter_url as twitterUrl, discord_url as discordUrl,
        organization_name as organizationName
       FROM events
       WHERE slug = ? AND organizer_id = ? AND is_published = 1`
    )
      .bind(slug, organizerId)
      .first<ResolvedEvent>();
  } else {
    const matches = await env.DB.prepare(
      `SELECT id, slug, organizer_id as organizerId, title, description, tagline,
        start_date as startDate, end_date as endDate, location, mode,
        application_deadline as applicationDeadline, website_url as websiteUrl,
        twitter_url as twitterUrl, discord_url as discordUrl,
        organization_name as organizationName
       FROM events
       WHERE slug = ? AND is_published = 1
       ORDER BY created_at DESC`
    )
      .bind(slug)
      .all<ResolvedEvent>();

    const rows = matches.results ?? [];
    if (rows.length > 1) {
      return {
        event: null as ResolvedEvent | null,
        error: "Multiple events share this slug. Use the organizer-scoped URL.",
        status: 409
      };
    }
    event = rows[0] ?? null;
  }

  if (!event) {
    return { event: null as ResolvedEvent | null, error: "Event not found.", status: 404 };
  }

  return { event, error: "", status: 200 };
};

export const isParticipantEligibleForEvent = async (env: Env, eventId: string, email: string) => {
  const access = await getParticipantAccessState(env, eventId, email);
  return access.allowed;
};

export const loadLatestParticipantApplication = async (
  env: Env,
  eventId: string,
  email: string
) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const application = await env.DB.prepare(
    `SELECT id, email, full_name as fullName, location, team_status as teamStatus,
      linkedin_url as linkedinUrl, github_url as githubUrl, status, custom_answers as customAnswers
     FROM applications
     WHERE event_id = ? AND lower(trim(email)) = ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(eventId, normalizedEmail)
    .first<{
      id: string;
      email: string;
      fullName: string | null;
      location: string | null;
      teamStatus: string | null;
      linkedinUrl: string | null;
      githubUrl: string | null;
      status: string | null;
      customAnswers: string | null;
    }>();

  if (!application) return null;

  return {
    id: application.id,
    email: normalizeEmail(application.email),
    fullName: String(application.fullName || "").trim(),
    location: String(application.location || "").trim(),
    teamStatus: String(application.teamStatus || "").trim(),
    linkedinUrl: String(application.linkedinUrl || "").trim(),
    githubUrl: String(application.githubUrl || "").trim(),
    status: String(application.status || "pending").trim() || "pending",
    customAnswers: parseApplicationAnswers(application.customAnswers)
  } satisfies ParticipantApplicationRecord;
};

export const getParticipantAccessState = async (env: Env, eventId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { allowed: false, reason: "missing-email", application: null as ParticipantApplicationRecord | null };
  }

  const application = await loadLatestParticipantApplication(env, eventId, normalizedEmail);
  if (application?.status === "approved") {
    return { allowed: true, reason: "approved-application", application };
  }
  if (application?.status === "pending") {
    return { allowed: false, reason: "pending-application", application };
  }
  if (application?.status === "rejected") {
    return { allowed: false, reason: "rejected-application", application };
  }

  const submissions = await env.DB.prepare(
    `SELECT contact_email as contactEmail, members
     FROM submissions
     WHERE event_id = ?`
  )
    .bind(eventId)
    .all<{ contactEmail: string; members: string | null }>();

  const allowedBySubmission = (submissions.results ?? []).some((row) => {
    if (normalizeEmail(row.contactEmail) === normalizedEmail) return true;
    return extractEmails(row.members ?? "").includes(normalizedEmail);
  });

  return {
    allowed: allowedBySubmission,
    reason: allowedBySubmission ? "existing-submission" : "no-access",
    application
  };
};

export const getParticipantDisplayName = async (env: Env, eventId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const application = await loadLatestParticipantApplication(env, eventId, normalizedEmail);
  return String(application?.fullName || "").trim() || fallbackDisplayName(normalizedEmail);
};

export const generateJoinCode = async (env: Env, eventId: string) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      const next = crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length;
      code += alphabet[next];
    }

    const existing = await env.DB.prepare(
      `SELECT id
       FROM participant_teams
       WHERE event_id = ? AND join_code = ?`
    )
      .bind(eventId, code)
      .first<{ id: string }>();

    if (!existing) return code;
  }

  throw new Error("Unable to generate a unique join code.");
};

export const loadParticipantTeam = async (env: Env, eventId: string, email: string) => {
  const membership = await env.DB.prepare(
    `SELECT pt.id, pt.name, pt.join_code as joinCode, pt.created_by_email as createdByEmail
     FROM participant_team_members tm
     INNER JOIN participant_teams pt ON pt.id = tm.team_id
     WHERE tm.event_id = ? AND lower(trim(tm.participant_email)) = ?`
  )
    .bind(eventId, normalizeEmail(email))
    .first<{ id: string; name: string; joinCode: string; createdByEmail: string }>();

  if (!membership) return null;

  const members = await env.DB.prepare(
    `SELECT participant_email as email, display_name as displayName
     FROM participant_team_members
     WHERE team_id = ?
     ORDER BY created_at ASC`
  )
    .bind(membership.id)
    .all<{ email: string; displayName: string | null }>();

  return {
    id: membership.id,
    name: membership.name,
    joinCode: membership.joinCode,
    createdByEmail: membership.createdByEmail,
    members: (members.results ?? []).map((member) => ({
      email: normalizeEmail(member.email),
      displayName: String(member.displayName || "").trim() || fallbackDisplayName(member.email)
    }))
  } satisfies ParticipantTeamRecord;
};

export const loadTeamDirectory = async (env: Env, eventId: string) => {
  const teams = await env.DB.prepare(
    `SELECT id, name
     FROM participant_teams
     WHERE event_id = ?
     ORDER BY updated_at DESC, created_at DESC`
  )
    .bind(eventId)
    .all<{ id: string; name: string }>();

  const entries = await Promise.all(
    (teams.results ?? []).map(async (team) => {
      const members = await env.DB.prepare(
        `SELECT participant_email as email, display_name as displayName
         FROM participant_team_members
         WHERE team_id = ?
         ORDER BY created_at ASC`
      )
        .bind(team.id)
        .all<{ email: string; displayName: string | null }>();

      const normalizedMembers = (members.results ?? []).map((member) => ({
        email: normalizeEmail(member.email),
        displayName: String(member.displayName || "").trim() || fallbackDisplayName(member.email)
      }));

      return {
        id: team.id,
        name: team.name,
        memberCount: normalizedMembers.length,
        members: normalizedMembers
      } satisfies TeamDirectoryEntry;
    })
  );

  return entries;
};

export const loadParticipantSubmission = async (
  env: Env,
  eventId: string,
  email: string,
  teamId?: string | null
) => {
  const normalizedEmail = normalizeEmail(email);

  const directMatch = await env.DB.prepare(
    `SELECT id, project_name as projectName, description, track,
      repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
      created_at as createdAt
     FROM submissions
     WHERE event_id = ?
       AND (
         (? IS NOT NULL AND team_id = ?)
         OR lower(trim(created_by_participant_email)) = ?
         OR lower(trim(contact_email)) = ?
       )
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(eventId, teamId ?? null, teamId ?? null, normalizedEmail, normalizedEmail)
    .first<ParticipantSubmissionRecord>();

  if (directMatch) return directMatch;

  const submissions = await env.DB.prepare(
    `SELECT id, project_name as projectName, description, track,
      repo_url as repoUrl, demo_url as demoUrl, deck_url as deckUrl,
      members, created_at as createdAt
     FROM submissions
     WHERE event_id = ?
     ORDER BY created_at DESC`
  )
    .bind(eventId)
    .all<ParticipantSubmissionRecord & { members: string | null }>();

  const fallback = (submissions.results ?? []).find((submission) =>
    extractEmails(submission.members ?? "").includes(normalizedEmail)
  );

  if (!fallback) return null;

  const { members: _members, ...record } = fallback;
  return record satisfies ParticipantSubmissionRecord;
};
