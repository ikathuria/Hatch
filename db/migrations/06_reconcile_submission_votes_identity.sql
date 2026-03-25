PRAGMA defer_foreign_keys = ON;

CREATE TABLE submission_votes_new (
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

INSERT INTO submission_votes_new (
  id,
  event_id,
  submission_id,
  participant_session_id,
  participant_email,
  created_at
)
SELECT
  id,
  event_id,
  submission_id,
  participant_session_id,
  lower(trim(coalesce(normalized_email, ''))),
  created_at
FROM submission_votes;

DROP TABLE submission_votes;
ALTER TABLE submission_votes_new RENAME TO submission_votes;

CREATE UNIQUE INDEX IF NOT EXISTS submission_votes_unique_participant_project
ON submission_votes (event_id, submission_id, participant_email);

CREATE INDEX IF NOT EXISTS submission_votes_event_participant_idx
ON submission_votes (event_id, participant_email);
