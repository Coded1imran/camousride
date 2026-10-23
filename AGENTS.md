# CampusRide — Agent & Project Guidelines

## Project
AI-powered ride platform for university campuses (hackathon MVP).
Solves unsafe late-night walks, unreliable hostel↔campus transport, expensive
off-campus rides, and gives transport offices demand visibility.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** SQLite via Prisma ORM (`prisma/schema.prisma`)
- **Auth:** JWT (jsonwebtoken) + bcrypt password hashing; roles: STUDENT | DRIVER | ADMIN
- **Validation:** Zod on every inbound API body/query
- **Maps:** Leaflet + React-Leaflet + OpenStreetMap tiles
- **AI:** Gemma 4 via a single wrapper module `src/lib/gemma.ts` (OpenAI-compatible
  endpoint). Model name, base URL and key live ONLY in `.env` (`GEMINI_API_KEY`,
  `GEMINI_BASE_URL`, `GEMINI_MODEL`). Swappable by changing env — no code change.
- **Everything else open source.**

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npx prisma migrate dev` / `npx prisma db push` — DB sync
- `npx prisma db seed` — seed demo data
- `npx tsc --noEmit` — typecheck
- `npm run lint`

## Directory Conventions
```
src/
  app/
    (auth)/login, (auth)/register
    (student)/dashboard, rides/new, rides/[id], ai/activity
    (driver)/dashboard, vehicles, availability
    (admin)/dashboard, ops, heatmap
  api/
    auth/{register,login,logout,me}
    rides/{id}/{accept,start,complete,cancel,rate,sos}, rides (POST/GET)
    ai/{book,carpool,match,fare,explain,safety,ops/ask}
    dispatch, admin/{heatmap,safety,drivers}
  lib/
    gemma.ts          # ALL AI calls funnel through here; every call logged
    auth.ts           # JWT sign/verify helpers
    prisma.ts         # Prisma client singleton
    validation/       # shared Zod schemas
    fare.ts           # fare computation (base + perKm + perMin + surge - pool)
  components/         # shared UI (MapView, StatusTimeline, SOSButton, AIChat...)
  db/schema.prisma
```

## AI Rules (critical)
- One module owns Gemma: `src/lib/gemma.ts` exports typed helpers
  (`createRideFromText`, `askCampusOps`, `matchCarpool`, `explainFare`,
  `safetyCheck`, `dispatchRanking`, `chat`).
- Every AI call is logged via `AICallLog` (input, output, latency, tokens,
  model, fallbackUsed) — surfaced in the "AI Activity" panel.
- Structured AI output is validated with Zod before use; nothing unvalidated
  reaches the DB or triggers actions.
- User free text is untrusted: prompt-injected content must not execute
  actions. Admin analytics questions only via allowlisted tool calls, never
  raw SQL.
- Graceful fallback: if key missing or API fails, helpers return safe,
  deterministic fallback results flagged `fallback: true`.

## Security Rules
- bcrypt password hashing, JWT httpOnly cookie.
- Role-based route protection in `middleware.ts` and API route guards.
- All inputs validated via Zod; parameterized queries only (Prisma handles).

## Workflow
- Build milestones in order; one at a time; run + typecheck after each.
- After each milestone: update `WORKFLOW.md`, commit with clear message.
- Demo polish > unfinished features; cut timetable first if short on time.

## Milestones (status)
1. Scaffold, schema, auth with role-based registration — TODO
2. Driver vehicle management and availability — TODO
3. Rider ride request and lifecycle — TODO
4. Gemma client + NL booking (EN + Pidgin) — TODO
5. Dispatch, carpool matching, fare explainer — TODO
6. Safety copilot + SOS flow — TODO
7. Admin dashboard, heatmap, Ask Campus Ops — TODO
8. Polish, error states, README with screenshots — TODO
