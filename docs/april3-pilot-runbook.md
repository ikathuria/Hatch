# April 3, 2026 Pilot Runbook

## Scope
- Pilot date: **Friday, April 3, 2026**
- Must-pass flows:
  - Organizer create/edit/publish event
  - Participant apply + submit
  - Judge score + organizer publish results
- Deferred unless time permits: People's Choice voting

## Owners
- Incident commander: assign one organizer lead
- Deployer: assign one engineer for deploy + rollback
- QA operator: assign one person to run smoke checks and track defects

## Environment Setup
- `production`: default `wrangler.toml`
- `staging`: `wrangler.toml` `env.staging` section (fill real D1/R2 IDs before use)

## Preflight (Go/No-Go Inputs)
Run from repo root:

```sh
SMOKE_BASE_URL="https://hatch-staging.ishani-629.workers.dev/" D1_REMOTE=1 D1_ENV=staging npm run preflight
```

Preflight passes only when:
- build succeeds
- migration status is clean (no pending migrations)
- smoke checks pass (`/api/health`, `/api/events`, `/organizer/login`)

## D1 Backup Snapshot (Before Release)
Export remote DB snapshot:

```sh
npx wrangler d1 export hatch --remote --output "backups/hatch-$(date +%Y%m%d-%H%M%S).sql"
```

If using staging:

```sh
npx wrangler d1 export hatch --remote --env staging --output "backups/hatch-staging-$(date +%Y%m%d-%H%M%S).sql"
```

## Release Steps
1. Run preflight against staging.
2. Run migrations in target env:
   - `npm run d1:migrate` for production
   - `node scripts/apply-d1-migrations.mjs --database hatch --remote --env staging` for staging
3. Deploy app Worker:
   - `npm run deploy` for production
   - `npx wrangler deploy --env staging` for staging
4. Re-run smoke checks.

## Rollback Steps
1. Stop further writes (announce freeze to operators).
2. Roll back Worker deploy to prior known-good version via Wrangler dashboard/CLI.
3. If DB migration caused breakage:
   - create fresh backup of broken state
   - restore last known-good export into a recovery D1 database
   - repoint Worker binding or cut over after validation
4. Re-run smoke checks and one end-to-end organizer/judge flow.

## Go/No-Go Gates (By Apr 2, 2026 Evening)
- Zero P0/P1 defects in pilot-critical flows.
- Staging rehearsal completed end-to-end with test organizer, participant, and judge.
- Backup and rollback drill completed once.
- Design freeze in place (only critical bug fixes after gate).
