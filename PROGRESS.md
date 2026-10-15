# Project progress

## Phases done

- Phase 0 — Foundation.
- Phase 1 — Auth, roles, and audit.

## Decisions

- Development environment is Windows. Use `npm.cmd` in PowerShell because the local policy blocks `npm.ps1`.
- Docker Compose provides PostgreSQL 16 and Redis. Demo payments are configured as `MOCK_PAYMENTS=true`.
- The installed runtime is Node v24.21.0, while the project prompt specifies Node 20.
- Access JWTs expire after 15 minutes. HTTP-only refresh cookies last 7 days, rotate on refresh, and are revoked on logout through Redis.
- Password reset JWTs expire after 15 minutes and are single use. Without SMTP, development email content and reset token print to the API console as requested.
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
- npm reports 7 dependency vulnerabilities (2 moderate, 5 high) after Phase 1 dependencies were installed.
- `prisma migrate dev` cannot create its shadow database with the configured database user's permissions. Generate the schema migration and use `prisma migrate deploy`; this path succeeds.
- Browser click-through checks are still useful after starting the app: test each seeded role's redirect and the patient redirect from `/admin` to `/patient`.

## Checks already passing

- `npm.cmd test`: 13 API tests pass for health, registration, login, wrong password, refresh/logout, `/me`, profile access and audit, password reset, input validation, and admin role denial.
- `npm.cmd run lint`: passes.
- `npm.cmd run format:check`: passes.
- `npm.cmd --workspace apps/web run build`: passes.
- `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`: passes.
- Phase 1 migration applied and `npm.cmd --workspace apps/api run db:seed` creates one admin, two doctors, one operator, and one patient.
- All seeded roles logged in successfully; a patient receives 403 on `GET /api/admin/session`, while an admin receives 200.
- Patient profile read/write works and creates audit rows. An operator receives 403 on the profile endpoint.
- `GET http://localhost:3000/api/health` returns `{ "success": true, "data": { "status": "ok" } }` with PostgreSQL and Redis connected.
- Vite serves `/login` and proxies `/api/health` successfully.

## Next phase

- Phase 2 — Doctors, slots, appointments, and queue. Start only after the user replies `continue`.
