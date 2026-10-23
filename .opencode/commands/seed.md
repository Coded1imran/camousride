---
description: Seed CampusRide demo data (admin, drivers, vehicles, students, rides, zones)
argument: ""
mode: "subagent"
---

Seed the database with the hackathon demo dataset:
1 admin user, 3 drivers + their vehicles, 15 students, ~40 rides spread over
the last few days, and the campus location list (gates, hostels, faculties, library, cafeteria).

Run via: `npx prisma db seed` (script defined in package.json) or manually via prisma/seed.ts.

After seeding, report counts per model and remind how to reset (`npx prisma migrate reset`).
