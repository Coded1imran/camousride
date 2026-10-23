# CampusRide — OpenCode Workflow Log

This file logs how OpenCode was used during the CampusRide hackathon build.

## Sessions / plans
- 2026-10-23 — Initial planning session: architecture, DB schema, API routes, page list, milestones defined. Plan presented for approval; user approved starting to build.

## Agents used
- `backend` — API routes, Prisma, auth, ride lifecycle
- `frontend` — pages, components, maps, dashboards
- `safety-reviewer` — authz / validation / prompt-injection review
- `docs` — README / AGENTS / WORKFLOW upkeep

## Custom commands used
- `/seed` — seed demo dataset
- `/test-gemma` — exercise Gemma wrapper + fallbacks
- `/review` — safety & validation code review

## Milestones completed
- [x] none yet — started 2026-10-23

## Manual fixes / notes
- (to be filled per milestone)

## Open items
- Gemma API key / base URL / model to be provided by user; `src/lib/gemma.ts` must not hardcode them.
