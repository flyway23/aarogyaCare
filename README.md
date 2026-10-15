# AarogyaCare

AarogyaCare is a single-hospital management web app built as a college project demo. It is being developed in phases; see [PROGRESS.md](PROGRESS.md) for the current phase and setup state.

## Setup

Requirements: Node.js 20, npm, and Docker Desktop with Compose.

1. Copy `.env.example` to `.env`.
2. Start Docker Desktop, then start PostgreSQL and Redis: `docker compose up -d`.
3. Install dependencies: `npm.cmd install` (PowerShell) or `npm install`.
4. Generate the Prisma client: `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`.
5. Apply all database migrations: `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
6. Seed demo accounts, specialties, doctors, and schedules: `npm.cmd --workspace apps/api run db:seed`.
7. Start the API in one terminal: `npm.cmd run dev:api`.
8. Start the web app in another terminal: `npm.cmd run dev:web`.
9. Open http://localhost:5173.

The browser app calls the API through Vite's local proxy. `GET /api/health` checks PostgreSQL and Redis.

## Demo accounts

All seeded accounts use password `Pass@1234`:

- Admin: `admin@aarogyacare.demo`
- Doctors: `doctor1@aarogyacare.demo`, `doctor2@aarogyacare.demo`
- Operator: `operator@aarogyacare.demo`
- Patient: `patient@aarogyacare.demo`

The web app redirects signed-in users to their role portal. Patients can view and update their profile at `/patient/profile`, book a doctor at `/patient/book`, and view/cancel appointments at `/patient/appointments`. Operators can book walk-ins and manage the day's queue from `/operator`.

## Phase 1 API routes

- Public, rate-limited: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- Refresh-cookie routes: `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Authenticated, any of the four roles: `GET /api/auth/me`.
- Authenticated patient only: `GET /api/patients/me/profile`, `PUT /api/patients/me/profile`.
- Authenticated admin only: `GET /api/admin/session` (role access check for the admin portal).
- Public system check: `GET /api/health`.

Access tokens last 15 minutes. Refresh tokens are HTTP-only cookies, rotated on refresh and revoked on logout. In development without SMTP settings, password reset instructions (including the one-time token) are printed to the API console.

The frontend protects each role route and redirects a signed-in user to their own portal if they open another role's URL.

## Phase 2 API routes

- All four authenticated roles: `GET /api/specialties`, `GET /api/doctors?specialtyId=`, `GET /api/doctors/:id`, `GET /api/doctors/:id/slots?date=YYYY-MM-DD`, and `GET /api/doctors/:id/queue-info?date=&slotStart=`.
- Doctor only: `PUT /api/doctors/me/schedule`, `POST /api/doctors/me/leave`, `PUT /api/doctors/me/status`.
- Patient only: `GET /api/appointments/me`; patient or operator: `POST /api/appointments`, `POST /api/appointments/:id/cancel` (patients can cancel only their own).
- Operator only: `GET /api/appointments?doctorId=&date=`, `POST /api/appointments/:id/confirm`, `POST /api/appointments/:id/check-in`, `GET /api/queue?doctorId=&date=`, and `POST /api/queue/:id/no-show|skip|reorder`.
- `GET /api/health` remains public. All route bodies and query parameters are Zod validated.

Slot dates and schedules use Asia/Kolkata; stored appointment timestamps are UTC. A booking is held for five minutes and expired holds are cancelled by the API process. Payment processing and receipts are Phase 3.

## Checks

- Run API tests: `npm.cmd test`.
- Check lint: `npm.cmd run lint`.
- Check formatting: `npm.cmd run format:check`.
- Build the web app: `npm.cmd --workspace apps/web run build`.

The API tests use the local PostgreSQL database and seeded doctor, patient, and operator accounts. Start Docker, apply migrations, and run the seed command before `npm.cmd test`.

## Configuration

See `.env.example`. `MOCK_PAYMENTS=true` is selected for the demo.
