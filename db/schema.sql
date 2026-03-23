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
  slug TEXT NOT NULL UNIQUE,
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
  FOREIGN KEY (event_id) REFERENCES events(id)
);
