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
7. Start the API, email worker, and web app in separate terminals: `npm.cmd run dev:api`, `npm.cmd run dev:worker`, and `npm.cmd run dev:web`.
8. Open http://localhost:5173.

The browser app calls the API through Vite's local proxy. `GET /api/health` checks PostgreSQL and Redis.

## Demo accounts

All seeded accounts use password `Pass@1234`:

- Admin: `admin@aarogyacare.demo`
- Doctors: `doctor1@aarogyacare.demo`, `doctor2@aarogyacare.demo`
- Operator: `operator@aarogyacare.demo`
- Patient: `patient@aarogyacare.demo`

The web app redirects signed-in users to their role portal. Patients can view and update their profile at `/patient/profile`, book a doctor at `/patient/book`, and view, pay for, cancel, or print appointment receipts at `/patient/appointments`. Operators can book walk-ins, record cash/UPI/card payments, and manage the day's queue from `/operator`.

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

Slot dates and schedules use Asia/Kolkata; stored appointment timestamps are UTC. A booking is held for five minutes and expired holds are cancelled by the API process.

## Phase 3 payments

- `POST /api/payments/create-order` and `POST /api/payments/verify`: patient only; patients can only pay for their own held appointment.
- `POST /api/payments/webhook`: public Razorpay webhook with HMAC signature validation and idempotent processing.
- `POST /api/payments/offline`: operator only; accepts CASH, UPI, or CARD and confirms the appointment atomically.
- `POST /api/payments/:id/refund`: operator/admin only; applies full refund at 24+ hours before the slot, half refund at 2–24 hours, and zero below 2 hours after cancellation.
- `GET /api/payments/:id/receipt`: authenticated patient/operator/admin; patients can access only their own receipt. Returns printable HTML.

The default `MOCK_PAYMENTS=true` skips Razorpay and marks patient checkout paid for the demo. To exercise Razorpay test mode, set `MOCK_PAYMENTS=false` and provide `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in your local `.env`. Do not commit `.env`. The worker queues payment confirmation emails; without SMTP configured, development emails are printed in the API console.

The confirmation endpoint used in Phase 2 was removed to prevent confirming appointments without a payment record. Operators now confirm walk-ins through the offline payment endpoint.

## Phase 4 beds and emergency handling

- `GET /api/beds`: operator/admin only; groups ward inventory and counts by ward type.
- `POST /api/beds/:id/assign`, `/release`, `/status`, and `/reserve`: operator/admin only. Assignments accept a registered patient phone or an emergency case. Assignments/reservations are transactional; reservations expire after 30 minutes. Releasing an occupied bed moves it to `CLEANING`.
- `POST /api/emergency`: patient/operator. A patient case is linked to the signed-in patient and does not require payment.
- `GET /api/emergency`: operator/doctor/admin only, with critical cases first. Doctors see only emergencies for patients they have appointments with.
- `POST /api/emergency/:id/accept`, `/reserve-bed`, and `/close`: operator/admin only.
- `POST /api/appointments/:id/escalate`: operator only; links the emergency to its appointment.

The operator portal has a live bed board and emergency dashboard. Socket.IO verifies the access JWT and only operator, doctor, and admin connections can join the `staff` room. Bed counts and metadata-only emergency alerts are broadcast live; authorized staff load full emergency details through the API. New emergency emails are queued for `EMERGENCY_DESK_EMAIL`; configure SMTP in `.env` for actual delivery. In development, email bodies are omitted from console output.

The seed creates five wards and ten available beds for the demo. The patient portal has an urgent assistance form; it alerts the hospital team but does not arrange an ambulance.

## Checks

- Run API tests: `npm.cmd test`.
- Check lint: `npm.cmd run lint`.
- Check formatting: `npm.cmd run format:check`.
- Build the web app: `npm.cmd --workspace apps/web run build`.

The API tests use the local PostgreSQL database and seeded doctor, patient, and operator accounts. Start Docker, apply migrations, and run the seed command before `npm.cmd test`. The Phase 3 tests cover mock checkout, patient/operator access rules, receipt access, duplicate payment verification/webhooks, and all refund tiers.

## Configuration

See `.env.example`. `MOCK_PAYMENTS=true` is selected for the demo.

## Disclaimer

AarogyaCare is a college project, not a certified medical device. Machine-generated summaries are decision support only; doctors make all clinical decisions. A real deployment would need privacy and compliance review (in India: DPDP Act and ABDM guidelines).
