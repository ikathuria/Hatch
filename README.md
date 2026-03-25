# Hatch

Hatch is a hackathon hosting platform for communities, clubs, and teams that want to launch events without building custom tooling from scratch.

Organizers can create branded event pages, collect applications, receive project submissions, run structured judging, and publish results. Hackers can browse events, apply, submit projects, and vote in People’s Choice polls. Judges score submissions through secure links without organizer accounts.

## Features

### Marketing and discovery

- **Landing page** with hero, product highlights, and a browsable list of published events.
- **Event catalog** fed from the public events API (`/api/events`).

### Public event pages

- **Rich event detail**: title, tagline, description, schedule (start/end), location, mode, organization name, external links (website, X/Twitter, Discord), application deadline, theme, and **banner image** (URL or uploaded asset).
- **Tracks**: name, description, and optional prize copy for each track.
- **FAQ** blocks managed in the organizer editor.
- **Stable URLs**: default route `/events/<slug>`; when multiple organizers share the same slug, use **`/events/<organizer-id>/<slug>`** so every published event has an unambiguous link.

### Participant (hacker) flows

- **Applications**: register interest with profile fields, **preferred track**, team status, optional idea text, and consent.
- **Magic-link sign-in** per event (email-based) to gate submission and voting without a global hacker account.
- **Project submission**: team name, project name, description, **target track**, optional repo / demo / deck URLs, and team member notes.
- **People’s Choice**: after organizers publish results, participants can vote (subject to session rules); voting is separate from judge rubric scores.

### After results are published

- **Project gallery** with descriptions and links; submissions show **which track** each project entered.
- **Winner badges** for overall and per-track winners (and popularity highlights where configured).
- Voting controls for People’s Choice when the participant is signed in.

### Organizer suite

- **Account lifecycle**: sign up, log in, session-backed dashboard.
- **Event CRUD**: create and edit events from the dashboard; **draft vs published** visibility for the public listing.
- **Multi-tab editor**: core identity, logistics, tracks, FAQ, **judging**, and **exports** (for events that already exist).
- **Banner images**: paste a URL or **upload** to Cloudflare R2 (validated server-side).
- **CSV exports**: download applications and submissions for offline review.

### Judging and results

- **Rubric**: configurable score scale (e.g. 1–10, 1–100), multiple **criteria with weights**, persisted per event.
- **Judge access**: generate **revocable links** with optional **PIN**, **expiry**, and labels; judges open **`/judge/<token>`** (no organizer login).
- **Judge workspace**: list submissions with **track labels**, per-criterion scores, optional comments, and **autosave** of scores.
- **Organizer judging workspace** (event editor Judging tab or full-page **`/organizer/events/<id>/judging`**):
  - Live **scoreboard** (rank, project, track, team, aggregate score, votes, winner/tie indicators).
  - **Tie detection** at overall and per-track scope; **tie-break** workflow when multiple projects share the top score.
  - **Winners**: when there are **no ties**, leaders from the weighted scores are **applied automatically** to stored winners on load. Organizers can enable **manual override** (per browser session) to pick different winners, then **save**. Ties still require an explicit choice.
  - **Publish results** flips the event to published, unlocks the public gallery and voting presentation, and **locks** judge scoring for that event.

### Legal and misc

- **Privacy**, **Terms**, and **Code of conduct** pages.
- **`debug-env`** page exists for environment diagnostics in development (remove or protect in production if you expose this deployment).

## Tech stack

- **Astro** (SSR) and **Tailwind CSS**
- **Cloudflare** adapter for Astro (Workers)
- **Cloudflare D1** for relational data
- **Cloudflare R2** for banner storage
- **Wrangler** for local runtime and deployment

## Core architecture

- `src/pages/` — UI routes (marketing, events, organizer, judge portal).
- `src/pages/api/*` — Server routes (organizer auth, events, applications, submissions, participants, judge sessions, rubrics, winners, uploads, exports).
- `src/lib/server/` — Auth, judging math, validation, and shared API helpers.
- `db/schema.sql` and `db/migrations/*` — Schema and incremental migrations.
- `wrangler.toml` — Cloudflare bindings (`DB` → D1, `UPLOADS` → R2).

## Local development

```sh
npm install
npm run dev
```

The app runs at `http://localhost:4321` (strict port; see `astro.config.mjs`).

## Cloudflare setup

1. Install and authenticate Wrangler:

```sh
npm install -g wrangler
wrangler login
```

2. Create required resources (names should match `wrangler.toml` or update the file accordingly):

```sh
wrangler d1 create hatch
wrangler r2 bucket create hatch-uploads
```

3. Apply the base schema:

```sh
wrangler d1 execute hatch --file db/schema.sql --remote
```

4. If you are upgrading an existing Hatch database, run pending migrations in order:

```sh
wrangler d1 execute hatch --file db/migrations/01_add_org_social.sql --remote
wrangler d1 execute hatch --file db/migrations/02_banner_url.sql --remote
wrangler d1 execute hatch --file db/migrations/03_judging_and_participants.sql --remote
wrangler d1 execute hatch --file db/migrations/04_participant_vote_identity.sql --remote
wrangler d1 execute hatch --file db/migrations/05_scope_event_slug_to_organizer.sql --remote
```

5. Ensure `wrangler.toml` has matching binding names (`DB`, `UPLOADS`) and correct resource IDs for your account.

## Deploy on Cloudflare Workers

This project targets **Cloudflare Workers** (not Pages-only hosting).

```sh
npm run build
npx wrangler deploy
```

Or:

```sh
npm run deploy
```

## Typical flows

### Organizer

1. Sign up at `/organizer/signup` and log in.
2. Create an event from `/organizer/dashboard` and fill core content, tracks, and FAQ.
3. Configure judging (rubric, judge links) when you are ready; optional full-page judging at `/organizer/events/<id>/judging`.
4. Upload a banner and publish the event.
5. Share **`/events/<organizer-id>/<slug>`** (recommended) or **`/events/<slug>`** when the slug is unique.
6. Export CSVs, resolve any judging ties, confirm winners, then **publish results**.

### Participant

1. Open the public event URL, apply before the deadline, and use the magic link when prompted to submit or vote.
2. After results go live, browse the gallery, vote if eligible, and view winners.

### Judge

1. Open the organizer-provided link `/judge/<token>`; enter PIN if required.
2. Score each submission against the rubric; submissions show **track** context. Scores lock after results are published.

## Scripts

```sh
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview production build locally
npm run deploy    # build + deploy to Cloudflare Workers
```
