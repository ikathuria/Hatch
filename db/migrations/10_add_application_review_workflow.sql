ALTER TABLE events
ADD COLUMN application_form_fields TEXT;

ALTER TABLE applications
ADD COLUMN linkedin_url TEXT;

ALTER TABLE applications
ADD COLUMN github_url TEXT;

ALTER TABLE applications
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE applications
ADD COLUMN reviewed_at TEXT;

ALTER TABLE applications
ADD COLUMN reviewed_by_organizer_id TEXT;

ALTER TABLE applications
ADD COLUMN custom_answers TEXT;
