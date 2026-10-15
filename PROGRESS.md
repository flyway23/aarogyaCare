# Project progress

## Phases done

- Phase 0 — Foundation.
- Phase 1 — Auth, roles, and audit.
- Phase 2 — Doctors, slots, appointments, and queue.

## Decisions

- Development environment is Windows. Use `npm.cmd` in PowerShell because the local policy blocks `npm.ps1`.
- Docker Compose provides PostgreSQL 16 and Redis. Demo payments are configured as `MOCK_PAYMENTS=true`.
- The installed runtime is Node v24.21.0, while the project prompt specifies Node 20.
- Access JWTs expire after 15 minutes. HTTP-only refresh cookies last 7 days, rotate on refresh, and are revoked through Redis.
- Appointment slot dates and schedule weekdays use Asia/Kolkata; stored timestamps are UTC.
- Appointment holds last five minutes and an API process interval cancels expired holds every minute.
- Operator appointment and queue responses include identity/contact and scheduling data but omit the patient's free-text visit reason.
- Doctor demo schedules run weekdays 09:00–13:00 and 13:00–17:00 Asia/Kolkata; seeded specialties are General Medicine, Cardiology, and Dermatology.
- Seeded demo roles share password `Pass@1234`.

## How to run

1. Copy `.env.example` to `.env` and start Docker Desktop.
2. Run `docker compose up -d`.
3. Run `npm.cmd install`.
4. Run `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`.
5. Run `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
6. Run `npm.cmd --workspace apps/api run db:seed`.
7. Start `npm.cmd run dev:api` and `npm.cmd run dev:web` in separate terminals.

## Known issues

- Node v24 is installed here; Node 20 is specified in the prompt.
- npm reports 7 dependency vulnerabilities (2 moderate, 5 high) from the installed dependency set.
- `prisma migrate dev` cannot create a shadow database with the configured database user's permissions. Generate/apply migrations with `prisma migrate deploy`; that path succeeds.
- Payment confirmation and receipts are Phase 3. An operator can confirm a demo booking in this phase; no payment record is created yet.
- Browser click-through remains useful to inspect the booking screens visually; the production bundle and API workflows are verified.

## Checks

- `npm.cmd test`: 16 API tests pass, including a live PostgreSQL `Promise.all` test where one same-slot booking succeeds and one receives 409.
- `npm.cmd run lint` and `npm.cmd run format:check`: pass.
- `npm.cmd --workspace apps/web run build`: passes.
- `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma` and `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`: pass; all three migrations are applied.
- `npm.cmd --workspace apps/api run db:seed`: creates demo accounts, three specialties, doctor profiles, and weekday schedules.
- API integration tests exercise directory, slots, queue estimate, doctor schedule/leave/status, patient booking/list/cancel, operator walk-in/confirm/check-in, queue list/reorder/no-show/skip, hold release, and role denial.
- `GET http://localhost:3000/api/health` returns success with PostgreSQL and Redis connected. Vite serves the app on `http://localhost:5173`.

## Phase 2 route protection

- Public system route: `GET /api/health`.
- Authenticated patient/doctor/operator/admin: `GET /api/specialties`, `GET /api/doctors`, `GET /api/doctors/:id`, `GET /api/doctors/:id/slots`, `GET /api/doctors/:id/queue-info`.
- Authenticated doctor only: `PUT /api/doctors/me/schedule`, `POST /api/doctors/me/leave`, `PUT /api/doctors/me/status`.
- Authenticated patient only: `GET /api/appointments/me`; patient or operator: `POST /api/appointments`, `POST /api/appointments/:id/cancel` (patient is limited to their own appointment).
- Authenticated operator only: `GET /api/appointments`, `POST /api/appointments/:id/confirm`, `POST /api/appointments/:id/check-in`, `GET /api/queue`, and queue `no-show`, `skip`, and `reorder` actions.

## Next phase

- Phase 3 — Payments. Start only after the user replies `continue`.
