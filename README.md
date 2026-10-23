# CampusRide

AI-powered rides for university campuses, built with Next.js, Prisma, SQLite, and Gemma 4.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`, then set `GEMINI_API_KEY` and a local `JWT_SECRET`.
3. Sync the database: `npm run db:push`
4. Add demo accounts and drivers without deleting existing data: `npm run db:seed-demo`
5. Start the app: `npm run dev`

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

Seeded accounts share the password `password123`.

- Student: `demo.student@campusride.edu.ng`
- Driver: `tunde.driver@campusride.edu.ng`

The demo seed creates a student account and ten drivers with vehicles and all-day
availability. It preserves existing users, rides, and other data. The separate
`npm run db:seed` command clears and recreates the local demo database.
