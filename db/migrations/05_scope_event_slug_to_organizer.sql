PRAGMA defer_foreign_keys = ON;

CREATE TABLE _backup_event_tracks AS SELECT * FROM event_tracks;
CREATE TABLE _backup_event_faqs AS SELECT * FROM event_faqs;
CREATE TABLE _backup_applications AS SELECT * FROM applications;
CREATE TABLE _backup_submissions AS SELECT * FROM submissions;
CREATE TABLE _backup_event_rubrics AS SELECT * FROM event_rubrics;
CREATE TABLE _backup_event_rubric_criteria AS SELECT * FROM event_rubric_criteria;
CREATE TABLE _backup_judge_links AS SELECT * FROM judge_links;
CREATE TABLE _backup_judge_sessions AS SELECT * FROM judge_sessions;
CREATE TABLE _backup_judge_scores AS SELECT * FROM judge_scores;
CREATE TABLE _backup_event_winners AS SELECT * FROM event_winners;
CREATE TABLE _backup_event_tie_breaks AS SELECT * FROM event_tie_breaks;
CREATE TABLE _backup_participant_magic_links AS SELECT * FROM participant_magic_links;
CREATE TABLE _backup_participant_sessions AS SELECT * FROM participant_sessions;
CREATE TABLE _backup_submission_votes AS SELECT * FROM submission_votes;

DROP TABLE submission_votes;
DROP TABLE event_tie_breaks;
DROP TABLE event_winners;
DROP TABLE judge_scores;
DROP TABLE judge_sessions;
DROP TABLE judge_links;
DROP TABLE event_rubric_criteria;
DROP TABLE event_rubrics;
DROP TABLE participant_magic_links;
DROP TABLE participant_sessions;
DROP TABLE submissions;
DROP TABLE applications;
DROP TABLE event_tracks;
DROP TABLE event_faqs;

CREATE TABLE events_new (
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

INSERT INTO events_new (
  id,
  organizer_id,
  created_at,
  updated_at,
  slug,
  title,
  tagline,
  description,
  start_date,
  end_date,
  location,
  mode,
  organization_name,
  website_url,
  twitter_url,
  discord_url,
  max_participants,
  application_deadline,
  theme,
  banner_url,
  is_published,
  results_status,
  results_published_at
)
SELECT
  id,
  organizer_id,
  created_at,
  updated_at,
  slug,
  title,
  tagline,
  description,
  start_date,
  end_date,
  location,
  mode,
  organization_name,
  website_url,
  twitter_url,
  discord_url,
  max_participants,
  application_deadline,
  theme,
  banner_url,
  is_published,
  results_status,
  results_published_at
FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

CREATE TABLE event_tracks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  prize TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE event_faqs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE applications (
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

CREATE TABLE submissions (
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
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE event_rubrics (
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

CREATE TABLE event_rubric_criteria (
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

CREATE TABLE judge_links (
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

CREATE TABLE judge_sessions (
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

CREATE TABLE judge_scores (
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

CREATE TABLE event_winners (
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

CREATE TABLE event_tie_breaks (
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

CREATE TABLE participant_magic_links (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE participant_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE submission_votes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  participant_session_id TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, participant_session_id, submission_id),
  UNIQUE (event_id, normalized_email, submission_id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (participant_session_id) REFERENCES participant_sessions(id)
);

INSERT INTO event_tracks SELECT * FROM _backup_event_tracks;
INSERT INTO event_faqs SELECT * FROM _backup_event_faqs;
INSERT INTO applications SELECT * FROM _backup_applications;
INSERT INTO submissions SELECT * FROM _backup_submissions;
INSERT INTO event_rubrics SELECT * FROM _backup_event_rubrics;
INSERT INTO event_rubric_criteria SELECT * FROM _backup_event_rubric_criteria;
INSERT INTO judge_links SELECT * FROM _backup_judge_links;
INSERT INTO judge_sessions SELECT * FROM _backup_judge_sessions;
INSERT INTO judge_scores SELECT * FROM _backup_judge_scores;
INSERT INTO event_winners SELECT * FROM _backup_event_winners;
INSERT INTO event_tie_breaks SELECT * FROM _backup_event_tie_breaks;
INSERT INTO participant_magic_links SELECT * FROM _backup_participant_magic_links;
INSERT INTO participant_sessions SELECT * FROM _backup_participant_sessions;
INSERT INTO submission_votes SELECT * FROM _backup_submission_votes;

DROP TABLE _backup_event_tracks;
DROP TABLE _backup_event_faqs;
DROP TABLE _backup_applications;
DROP TABLE _backup_submissions;
DROP TABLE _backup_event_rubrics;
DROP TABLE _backup_event_rubric_criteria;
DROP TABLE _backup_judge_links;
DROP TABLE _backup_judge_sessions;
DROP TABLE _backup_judge_scores;
DROP TABLE _backup_event_winners;
DROP TABLE _backup_event_tie_breaks;
DROP TABLE _backup_participant_magic_links;
DROP TABLE _backup_participant_sessions;
DROP TABLE _backup_submission_votes;
