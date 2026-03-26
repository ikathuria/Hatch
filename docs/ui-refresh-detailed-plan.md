# Detailed Implementation Steps: Hatch UI Refresh

Last updated: 2026-03-25 (America/Chicago)
Owner: Product + Design + Frontend Engineering

## Summary
Execution source of truth for the Hatch redesign.
Brand direction is now governed by `docs/brand-identity.md`.
Priority order stays unchanged:
1. Reliability and interaction regressions first.
2. Wave 1 (Organizer + Judge).
3. Wave 2 (Public + Participant).
4. Accessibility + QA gates + sign-off.

## Step Status Tracker

| Step | Status | Notes |
| --- | --- | --- |
| 1. Artifact and workflow | Done | This doc is now the tracked checklist and is linked from `README.md` under Product and design docs. |
| 2. Preflight reliability audit | Done | Interaction inventory and defect log captured below. Baseline `npm run build` passed. |
| 3. Warm Nest foundation | Done | Semantic tokens, shared primitives, standardized button states, reduced-motion defaults, centralized microcopy scaffold, and shell cleanup completed. |
| 4. Wave 1: Organizer + Judge | Done | Organizer dashboard/editor/judging + judge workspace refreshed with clearer copy and explicit lock/success/error states. |
| 5. Wave 2: Public + Participant | Done | Landing, events discovery, event detail, apply, and submit surfaces refreshed with clarified primary paths. |
| 6. Accessibility and motion gates | In progress | Reduced motion + focus-visible defaults implemented. Full manual keyboard and contrast pass still required in browser QA. |
| 7. Regression QA + smoke tests | In progress | Build checks passed. Manual per-page checklist and end-to-end smoke scenarios still required. |
| 8. Rollout and sign-off | In progress | Code-side changes complete; awaiting manual QA sign-off gates listed below. |

## 1) Artifact + Workflow
- This document is the master execution checklist.
- `docs/brand-identity.md` is the source of truth for public-facing brand language and visual direction.
- Status now tracked per step in the table above.
- Linked from `README.md`:
  - `README.md` -> **Product and design docs** -> `docs/brand-identity.md`
  - `README.md` -> **Product and design docs** -> `docs/ui-refresh-detailed-plan.md`

## 2) Preflight Reliability Audit

### Interaction inventory (primary/secondary actions)

| Surface | Controls audited | Notes |
| --- | --- | --- |
| Organizer dashboard (`/organizer/dashboard`) | `Sign out`, `New event`, `Open editor`, `Public page` | Dead modal wiring removed; route-only create flow enforced. |
| Organizer event editor (`/organizer/events/:id`) | Top `Save changes`, tab triggers, `Add Track`, `Add FAQ`, export links, publish toggle | Save flow now stays in-editor with success status (no forced redirect on update). |
| Organizer judging panel | `Save rubric`, `Generate link`, `Copy`, `Revoke`, `Save winners`, `Publish results`, tie radio controls | Winner/tie/publish controls unified; publish/read-only behavior explicit. |
| Judge workspace (`/judge/:token`) | `Open workspace`, `Sign out`, score fields, autosave, `Save all & confirm` | Autosave language normalized; published events now clearly read-only. |
| Landing (`/`) | Primary/secondary hero CTAs, events cards CTAs | CTA hierarchy simplified and intentional. |
| Events discovery (`/events`) | Search, mode/timeline/sort filters, reset, event open CTA | Filter and empty/error messaging normalized. |
| Event detail (`/events/:slug`) | `Apply`, `Submit`, tab triggers, vote buttons, participant sign-out, share/calendar controls | Submit path now clearly routes to apply when user is not authorized for that event. |
| Participant apply (`/events/:slug/apply`) | Form submit, validation states | Copy and validation/status language standardized. |
| Participant submit (`/events/:slug/submit`) | Auth gate actions, form submit, validation states | Auth gate and submission path clarified; consistent status messaging. |

### Defect log (preflight)

| ID | Page | Selector / control | Expected | Actual (before fix) | Severity | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | Organizer dashboard | `[data-open-create]` | Trigger exists or listener removed | Listener + modal wiring existed without a matching trigger button | High | Fixed |
| UI-002 | Shared shell | Hidden easter-egg controls (`[data-hatch-trigger]`, keyboard combos) | Workflow shell should not include hidden interaction paths | Hidden trigger + shortcuts in production shell | Medium | Fixed |
| UI-003 | Organizer editor save | Top save action | Save should confirm in place | Save redirected to dashboard immediately after update | Medium | Fixed |

### Locked behavior decision: "New Event"
- Decision: **Route link only** (`/organizer/events/new`).
- Modal flow is removed from organizer dashboard.

### Baseline build (before restyle changes)
- Command: `npm run build`
- Date/time: 2026-03-25 21:13 CDT
- Result: **PASS**

## 3) Brand Foundation

Completed:
- Added semantic token foundation in `src/styles/global.css`:
  - background tiers, text tiers, action colors, border/focus tokens, spacing/radius, elevation, motion timing.
- Introduced/normalized shared UI primitives:
  - `src/components/ui/Button.astro`
  - `src/components/ui/Card.astro`
  - `src/components/ui/Input.astro`
  - `src/components/ui/Badge.astro`
  - `src/components/ui/Tabs.astro`
  - `src/components/ui/SectionHeader.astro`
  - `src/components/ui/EmptyState.astro`
- Standardized button states in CSS:
  - default, hover, active, focus-visible, disabled, loading (`aria-busy` / `.is-loading`), success, error.
- Added reduced-motion defaults globally:
  - `@media (prefers-reduced-motion: reduce)` now disables non-essential animation/transition behavior.
- Removed hidden/easter-egg shell interactions from `BaseLayout.astro`.
- Added centralized microcopy scaffold:
  - `src/content/microcopy.ts`
- Locked the public design identity to `Hatch` with a warm, minimal incubation metaphor.
- Retained `Warm Nest Lab` as internal historical shorthand only, not public UI language.

## 4) Wave 1 (Organizer + Judge)

Completed:
- Organizer dashboard simplified and made action-first:
  - Primary action remains `New event` (route only).
  - Dead modal removed.
  - Event cards streamlined with clear status/action controls.
- Organizer event editor:
  - Copy rewritten to clear, direct labels.
  - Save behavior updated to in-place success status for edits.
  - Create flow opens new event editor directly after create.
- Organizer judging:
  - Winner/tie/publish controls consolidated in one action area.
  - Explicit read-only states when results are published.
  - Empty states and status messages normalized.
- Judge workspace:
  - Access and autosave language normalized.
  - Read-only state made explicit when results are published.

## 5) Wave 2 (Public + Participant)

Completed:
- Landing page:
  - Reworked into a calmer Hatch layout with stronger CTA hierarchy.
  - Removed noisy animated visual treatment from core flow.
- Events discovery:
  - Filter controls and event cards retained with normalized empty/error states.
- Event detail:
  - Primary participant path clarified (`Apply` first when not authorized for submit/vote).
  - Gallery, track, FAQ fallback copy standardized.
- Apply/submit flows:
  - Full UX copy rewrite to clear action-first language.
  - Validation and status messaging made consistent.
  - Route behavior unchanged.

## 6) Accessibility + Motion Gates

Implemented:
- Global focus-visible ring defaults.
- Reduced-motion fallback for non-essential animation.
- Status containers now use `role="status"` / `aria-live="polite"` in key flows.

Still required (manual QA):
- Full WCAG AA contrast checks across all states (dark + light themes).
- Full keyboard traversal checks on all redesigned pages.

## 7) Regression QA Checklist + Smoke Notes

### Per-page checklist status
- Button visible and reachable: Partial (manual QA pending)
- Interaction works: Partial (manual QA pending)
- Disabled/loading states correct: Partial (manual QA pending)
- Keyboard reachable and focus ring visible: Partial (manual QA pending)
- Success/error status text shown: Partial (manual QA pending)

### Smoke scenarios status
- Organizer flow (login -> dashboard -> create/edit -> judging -> publish/export): Pending manual run
- Judge flow (token URL -> auth -> score/autosave -> lock behavior): Pending manual run
- Public/participant flow (discover -> detail -> apply/submit -> vote gating): Pending manual run

### Build logs
- Baseline (preflight): 2026-03-25 21:13 CDT - PASS
- Wave checkpoint: 2026-03-25 22:10 CDT - PASS
- Final checkpoint: 2026-03-25 22:11 CDT - PASS

## 8) Rollout + Sign-off

Current sign-off state: **Pending manual QA gates**

Required for final sign-off:
- No missing primary buttons.
- No dead selectors/listeners.
- WCAG AA checks complete.
- Consistent microcopy usage across redesigned surfaces.

## Public APIs / Interfaces / Types
- No backend API, schema, or route changes.
- Frontend contracts added/standardized:
  - semantic token contract in global styles,
  - shared primitive component prop contract,
  - centralized microcopy structure (`src/content/microcopy.ts`).

## Test Cases and Scenarios
1. Button reliability.
- Every page-level primary/secondary action is present, clickable, and keyboard accessible.

2. State messaging.
- Submit/save flows show consistent loading/success/error messages.

3. Lock/read-only handling.
- Judge and organizer judging controls block edits after results are published.

4. Responsive parity.
- Mobile + desktop verification for landing, dashboard, editor, event detail, and judge workspace.

5. Accessibility checks.
- Contrast, focus visibility, keyboard traversal, and reduced-motion behavior.

## Assumptions and Defaults
- Public identity: Hatch.
- Internal mood: warm, minimal incubation metaphor.
- Playfulness: playful shell, serious core workflows.
- Wave order: Organizer + Judge first, then Public + Participant.
- Copy scope: full UX rewrite.
- Easter eggs: removed entirely.
- QA method: checklist + smoke tests.
- Accessibility gate: WCAG AA required.
