# AarogyaCare

AarogyaCare is a single-hospital management web app built as a college project demo. It is being developed in phases; see [PROGRESS.md](PROGRESS.md) for the current phase and setup state.

## Setup

Requirements: Node.js 20, npm, and Docker Desktop with Compose.

1. Copy `.env.example` to `.env`.
2. Start Docker Desktop, then start PostgreSQL and Redis: `docker compose up -d`.
3. Install dependencies: `npm.cmd install` (PowerShell) or `npm install`.
4. Generate the Prisma client: `npm.cmd --workspace apps/api run prisma:generate`.
5. Apply the initial database migration: `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
6. Start the API in one terminal: `npm.cmd run dev:api`.
7. Start the web app in another terminal: `npm.cmd run dev:web`.
8. Open http://localhost:5173.
9. Seed the Phase 1 demo accounts: `npm.cmd --workspace apps/api run db:seed`.

The browser app calls the API through Vite's local proxy. `GET /api/health` checks PostgreSQL and Redis.

## Demo accounts

All seeded accounts use password `Pass@1234`:

- Admin: `admin@aarogyacare.demo`
- Doctors: `doctor1@aarogyacare.demo`, `doctor2@aarogyacare.demo`
- Operator: `operator@aarogyacare.demo`
- Patient: `patient@aarogyacare.demo`

The web app redirects signed-in users to their role portal. Patients can view and update their own profile at `/patient/profile`.

## Phase 1 API routes

- Public, rate-limited: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- Refresh-cookie routes: `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Authenticated, any of the four roles: `GET /api/auth/me`.
- Authenticated patient only: `GET /api/patients/me/profile`, `PUT /api/patients/me/profile`.
- Authenticated admin only: `GET /api/admin/session` (role access check for the admin portal).
- Public system check: `GET /api/health`.

Access tokens last 15 minutes. Refresh tokens are HTTP-only cookies, rotated on refresh and revoked on logout. In development without SMTP settings, password reset instructions (including the one-time token) are printed to the API console.

The frontend protects each role route and redirects a signed-in user to their own portal if they open another role's URL.

## Checks

- Run API tests: `npm.cmd test`.
- Check lint: `npm.cmd run lint`.
- Check formatting: `npm.cmd run format:check`.

## Configuration

See `.env.example`. `MOCK_PAYMENTS=true` is selected for the demo.
