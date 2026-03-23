ALTER TABLE events ADD COLUMN results_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE events ADD COLUMN results_published_at TEXT;

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
  created_at TEXT NOT NULL,
  UNIQUE (participant_session_id, submission_id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (participant_session_id) REFERENCES participant_sessions(id)
);
