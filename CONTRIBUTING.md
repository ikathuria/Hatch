# Contributing to Hatch

Thanks for helping improve Hatch. This project is open source and community contributions are welcome.

## Ways to contribute

- Report bugs and UX issues.
- Suggest product or developer experience improvements.
- Improve docs, copy, and onboarding.
- Submit fixes and new features.

## Before you start

1. Check open issues and pull requests to avoid duplicate work.
2. For larger changes, open an issue first so we can align on scope.
3. Keep pull requests focused on one change area.

## Local setup

```sh
npm install
npm run dev
```

App runs at `http://localhost:4321`.

## Development workflow

1. Create a feature branch from `main`.
2. Make your changes in small, reviewable commits.
3. Verify the app builds before opening a PR:

```sh
npm run build
```

4. If your change affects database behavior, update:
   - `db/schema.sql` for fresh installs
   - `db/migrations/*` with a forward-only migration for existing installs

## Code style expectations

- Follow existing project patterns and naming conventions.
- Prefer simple, readable solutions over clever abstractions.
- Keep API routes and UI changes consistent with current structure in `src/pages` and `src/components`.
- Avoid unrelated refactors in the same PR.

## Pull request checklist

- [ ] Build passes locally with `npm run build`
- [ ] Changes are scoped and clearly described
- [ ] Screenshots/GIFs included for UI changes
- [ ] Migration notes included if schema/data behavior changed
- [ ] Docs updated when behavior or setup changes

## Commit messages

Use clear, descriptive commit messages that explain intent (the "why"), not only file changes (the "what").

## Reporting security issues

Please do not open public issues for sensitive security reports. Contact the maintainer directly first so the issue can be triaged responsibly.

## Questions

If you are unsure where to start, open an issue describing what you want to work on and we can help you pick a good first task.
