# Hatch

Hatch is a hackathon hosting platform for communities, clubs, and teams that want to launch events without building custom tooling from scratch.

Organizers can create branded event pages, collect applications, receive project submissions, and export participant data. Hackers can browse events, apply, and submit projects through clean public flows.

## What this project includes

- Public landing page with published events
- Organizer authentication and dashboard
- Event creation and editing (schedule, details, banner, links, tracks, FAQ)
- Application and submission forms per event
- Organizer judging workflows (rubrics, judge links, winner selection, result publish)
- Participant magic-link auth and People’s Choice voting (separate from judge rankings)
- CSV exports for organizer-side applications and submissions
- File upload support for event banners

## Tech stack

- Astro (SSR) + Tailwind CSS
- Cloudflare adapter for Astro
- Cloudflare D1 for relational data
- Cloudflare R2 for banner image storage
- Wrangler for local runtime and deployment configuration

## Core architecture

- `src/pages/api/*` contains server routes (auth, events, applications, submissions, uploads).
- `db/schema.sql` and `db/migrations/*` define and evolve the database schema.
- `wrangler.toml` maps cloud bindings:
  - `DB` -> D1 database
  - `UPLOADS` -> R2 bucket

## Local development

```sh
npm install
npm run dev
```

App runs at `http://localhost:4321`.

## Cloudflare setup

1. Install and authenticate Wrangler:

```sh
npm install -g wrangler
wrangler login
```

2. Create required resources:

```sh
wrangler d1 create hatch
wrangler r2 bucket create hatch-uploads
```

3. Apply schema:

```sh
wrangler d1 execute hatch --file db/schema.sql --remote
```

4. If you are upgrading an existing Hatch database, run pending migrations in order:

```sh
wrangler d1 execute hatch --file db/migrations/01_add_org_social.sql --remote
wrangler d1 execute hatch --file db/migrations/02_banner_url.sql --remote
wrangler d1 execute hatch --file db/migrations/03_judging_and_participants.sql --remote
wrangler d1 execute hatch --file db/migrations/04_participant_vote_identity.sql --remote
```

5. Ensure `wrangler.toml` has matching binding names (`DB`, `UPLOADS`).

## Deploy on Cloudflare Workers

This project is configured to deploy on Cloudflare Workers (not Pages).

```sh
npm run build
npx wrangler deploy
```

You can also run:

```sh
npm run deploy
```

## Organizer flow

1. Sign up at `/organizer/signup`
2. Create an event from `/organizer/dashboard`
3. Upload banner and configure event settings
4. Publish event and share `/events/<slug>`
5. Review applications and submissions in the organizer panel

## Scripts

```sh
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview build output
npm run deploy    # build + deploy to Cloudflare Workers
```
