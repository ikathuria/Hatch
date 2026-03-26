CREATE TABLE IF NOT EXISTS organizers (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (organizer_id) REFERENCES organizers(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  location TEXT,
  mode TEXT,
  organization_name TEXT,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  max_participants INTEGER,
  application_deadline TEXT,
  theme TEXT,
  banner_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  results_status TEXT NOT NULL DEFAULT 'draft',
  results_published_at TEXT,
  UNIQUE (organizer_id, slug),
  FOREIGN KEY (organizer_id) REFERENCES organizers(id)
);

CREATE TABLE IF NOT EXISTS event_tracks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  prize TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS event_faqs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  role TEXT,
  location TEXT,
  track TEXT,
  team_status TEXT,
  idea TEXT,
  consent INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  team_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT NOT NULL,
  repo_url TEXT,
  demo_url TEXT,
  deck_url TEXT,
  track TEXT,
  members TEXT,
  contact_email TEXT NOT NULL,
  team_id TEXT,
  created_by_participant_email TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS participant_teams (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, name),
  UNIQUE (event_id, join_code),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS participant_team_members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, participant_email),
  UNIQUE (team_id, participant_email),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (team_id) REFERENCES participant_teams(id)
);

CREATE TABLE IF NOT EXISTS event_rubrics (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  min_score INTEGER NOT NULL DEFAULT 1,
  max_score INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS event_rubric_criteria (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  weight REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS judge_links (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  label TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  pin_hash TEXT,
  created_by_organizer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (created_by_organizer_id) REFERENCES organizers(id)
);

CREATE TABLE IF NOT EXISTS judge_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  judge_link_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (judge_link_id) REFERENCES judge_links(id)
);

CREATE TABLE IF NOT EXISTS judge_scores (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  rubric_criterion_id TEXT NOT NULL,
  judge_link_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (judge_link_id, submission_id, rubric_criterion_id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (rubric_criterion_id) REFERENCES event_rubric_criteria(id),
  FOREIGN KEY (judge_link_id) REFERENCES judge_links(id)
);

CREATE TABLE IF NOT EXISTS event_winners (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  track_name TEXT NOT NULL DEFAULT '',
  submission_id TEXT NOT NULL,
  created_by_organizer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, scope, track_name),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (created_by_organizer_id) REFERENCES organizers(id)
);

CREATE TABLE IF NOT EXISTS event_tie_breaks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  track_name TEXT NOT NULL DEFAULT '',
  submission_id TEXT NOT NULL,
  tied_submission_ids TEXT NOT NULL,
  note TEXT,
  resolved_by_organizer_id TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  UNIQUE (event_id, scope, track_name),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (resolved_by_organizer_id) REFERENCES organizers(id)
);

CREATE TABLE IF NOT EXISTS participant_magic_links (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS participant_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS submission_votes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  participant_session_id TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (participant_session_id, submission_id),
  UNIQUE (event_id, submission_id, participant_email),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (participant_session_id) REFERENCES participant_sessions(id)
);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS request_rate_limits_window_idx
ON request_rate_limits (window_start);

CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_team_per_event
ON submissions (event_id, team_id)
WHERE team_id IS NOT NULL;
