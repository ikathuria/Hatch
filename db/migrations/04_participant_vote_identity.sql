ALTER TABLE submission_votes ADD COLUMN participant_email TEXT NOT NULL DEFAULT '';

UPDATE submission_votes
SET participant_email = lower(trim(coalesce(participant_email, '')))
WHERE participant_email IS NOT NULL;

UPDATE submission_votes
SET participant_email = lower(
  trim(
    coalesce(
      (
        SELECT ps.email
        FROM participant_sessions ps
        WHERE ps.id = submission_votes.participant_session_id
      ),
      participant_email,
      ''
    )
  )
)
WHERE participant_email = '';

DELETE FROM submission_votes
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM submission_votes
  GROUP BY event_id, submission_id, participant_email
);

CREATE UNIQUE INDEX IF NOT EXISTS submission_votes_unique_participant_project
ON submission_votes (event_id, submission_id, participant_email);

CREATE INDEX IF NOT EXISTS submission_votes_event_participant_idx
ON submission_votes (event_id, participant_email);
