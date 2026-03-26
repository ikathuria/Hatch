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

ALTER TABLE submissions ADD COLUMN team_id TEXT;
ALTER TABLE submissions ADD COLUMN created_by_participant_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_team_per_event
ON submissions (event_id, team_id)
WHERE team_id IS NOT NULL;
