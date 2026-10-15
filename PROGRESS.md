# Project progress

## Phases done

- Phase 0 — Foundation.
- Phase 1 — Authentication, roles, audit basics, and patient profile.
- Phase 2 — Doctors, schedules, appointments, and queue.
- Phase 3 — Mock/Razorpay payments, receipts, refunds, and payment email queue.
- Phase 4 — Bed inventory, transactional reservations/assignments, and live emergency alerts.

## Decisions

- Windows development uses `npm.cmd` in PowerShell. Docker Compose runs PostgreSQL 16 and Redis; API, worker, and web run locally.
- Demo uses `MOCK_PAYMENTS=true`; mock checkout records a paid payment and confirms the appointment without Razorpay keys.
- Razorpay test mode uses the REST API and HMAC signature verification when mock mode is disabled.
- Payment confirmation is atomic with appointment confirmation. Repeated verification and webhook deliveries are idempotent.
- Refunds use the appointment cancellation timestamp: 100% at 24+ hours, 50% from 2 to under 24 hours, and 0% under 2 hours.
- Confirmation emails are queued with BullMQ and delivered by a separate worker. Without SMTP in development, Nodemailer prints the email to the API console.
- Bed transitions use row locks and re-read state inside PostgreSQL transactions; reserved beds expire after 30 minutes.
- Socket.IO authenticates access JWTs and only operator, doctor, and admin users join the `staff` room. Emergency desk email uses the configured `EMERGENCY_DESK_EMAIL` address.
- Socket emergency alerts broadcast only case ID, severity, location, status, and timestamp; doctors can list full details only for patients they have appointments with. Development email output omits email bodies.
- Slot dates and schedule weekdays use Asia/Kolkata; timestamps are stored in UTC. Appointment holds expire after five minutes.
- Seeded demo roles share password `Pass@1234`.

## How to run

1. Start Docker Desktop.
2. `docker compose up -d`
3. `npm.cmd install`
4. `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`
5. `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`
6. `npm.cmd --workspace apps/api run db:seed`
7. Start three terminals with `npm.cmd run dev:api`, `npm.cmd run dev:worker`, and `npm.cmd run dev:web`.
8. Open `http://localhost:5173`.

## Known issues

- The prompt specifies Node 20; this machine currently has Node 24.21.0.
- The last npm audit reported 7 vulnerabilities (2 moderate, 5 high). Review with `npm audit` before deployment.
- `prisma migrate dev` cannot create a shadow database with the configured database user's permissions. Use the committed migrations with `prisma migrate deploy`.
- Razorpay live gateway calls require test keys and were not exercised; mock mode and signed verification/webhook flows are covered by tests.

## Checks

- `npm.cmd test`: 26 API tests pass against PostgreSQL, including concurrent bed assignment, JWT-restricted Socket.IO alerts, role denial, payment idempotency, and 100/50/0 refund cases.
- `npm.cmd run lint` and `npm.cmd run format:check` pass.
- `npm.cmd --workspace apps/web run build` passes.
- All seven Prisma migrations are applied; seed creates demo accounts, specialties, doctors, weekday schedules, five wards, and ten beds.
- Phase 3 payment routes are covered by API tests. Phase 4 routes and live socket alerts are covered by API and Socket.IO integration tests.

## Phase 3 route protection

- `POST /api/payments/webhook`: public route protected by Razorpay HMAC signature validation.
- `POST /api/payments/create-order`, `POST /api/payments/verify`: authenticated patient only; payment ownership is checked against the appointment.
- `POST /api/payments/offline`: authenticated operator only.
- `POST /api/payments/:id/refund`: authenticated operator or admin only.
- `GET /api/payments/:id/receipt`: authenticated patient, operator, or admin; patient ownership enforced. Returns escaped HTML for printing.
- Payment request bodies and receipt query/IDs are Zod validated.

## Phase 4 route protection

- `GET /api/beds` and bed assign/release/status/reserve routes: operator or admin only.
- `POST /api/emergency`: patient or operator; patient submissions are linked to the authenticated patient account.
- `GET /api/emergency`: operator, doctor, or admin only; critical cases are listed first, and doctors see cases only for their own patients.
- Emergency accept/reserve-bed/close routes: operator or admin only.
- `POST /api/appointments/:id/escalate`: operator only; links the case to the existing appointment and repeated escalation returns that case.
- Socket.IO connections require an access JWT and only operator, doctor, and admin roles can join `staff`; live emergency broadcasts contain no patient identity or complaint.
- Request bodies and query parameters are Zod validated. Bed changes re-read locked rows in a transaction before applying transitions.

## Next phase

- Phase 5 — Document processing and summaries. Start only after the user replies `continue`.
