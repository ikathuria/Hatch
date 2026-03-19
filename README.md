# Hatch Platform

Multi-tenant hackathon hosting platform built with Astro + Tailwind and
Cloudflare Pages + D1 (free tier). API routes are served from Astro SSR
via the Cloudflare adapter.

## Local setup

```sh
npm install
npm run dev
```

To test API + D1 locally:

```sh
npx wrangler pages dev --d1=DB
```

## Cloudflare D1 setup (free tier)

1. Install the Wrangler CLI and log in:

```sh
npm install -g wrangler
wrangler login
```

2. Create the D1 database and update `wrangler.toml` with the database id:

```sh
wrangler d1 create hatch
```

3. Initialize schema:

```sh
wrangler d1 execute hatch --file db/schema.sql --remote
```

4. In Cloudflare Pages, add a D1 binding named `DB` that points to the same database.

## Organizer flow

1. Sign up at `/organizer/signup`.
2. Create an event from the dashboard.
3. Publish your event and share the public URL.

## Scripts

```sh
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview built site
```
