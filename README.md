# AarogyaCare

AarogyaCare is a single-hospital management web app built as a college project demo. It includes patient booking and mock checkout, operator queue/bed/emergency handling, doctor records and consultation summaries, patient privacy and follow-up tools, and a metadata-driven admin panel. The complete demo scope covers Phases 0–9; see [PROGRESS.md](PROGRESS.md) for checks and route protections.

## Architecture

```text
Browser (React + Vite :5173)
          | /api proxy, JWT
          v
Express API (:3000) ---- PostgreSQL (:5432)
          |                       |
          +---- Redis (:6379)     +---- Prisma
                   |
             BullMQ worker
       (email + document OCR)
```

## Setup

Requirements: Node.js 20, npm, and Docker Desktop with Compose.

1. Copy `.env.example` to `.env`.
2. Start Docker Desktop, then start PostgreSQL and Redis: `docker compose up -d`.
3. Install dependencies: `npm.cmd install` (PowerShell) or `npm install`.
4. Generate the Prisma client: `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`.
5. Apply all database migrations: `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
6. Seed demo accounts, 10 doctors, 3 specialties, 30 beds, appointments, an emergency, and fictional records: `npm.cmd --workspace apps/api run db:seed`.
7. Start the API, email worker, and web app in separate terminals: `npm.cmd run dev:api`, `npm.cmd run dev:worker`, and `npm.cmd run dev:web`.
8. Open http://localhost:5173.

The browser app calls the API through Vite's local proxy. `GET /api/health` checks PostgreSQL and Redis.

Patient documents are uploaded from `/patient/book` after reserving a slot or from `/patient/documents`. Files are stored locally in `apps/api/uploads/` (ignored by git), limited to PDF/JPG/PNG and 10 MB, and processed by the separate BullMQ worker. OCR downloads English language data on its first run and needs network access then. The included fake reports are under `apps/api/samples/`; with API and worker running, `node apps/api/samples/worker-smoke.mjs` exercises the separate worker.

## Demo accounts

All seeded accounts use password `Pass@1234`:

- Admin: `admin@aarogyacare.demo`
- Doctors: `doctor1@aarogyacare.demo` through `doctor10@aarogyacare.demo`
- Operator: `operator@aarogyacare.demo`
- Patient: `patient@aarogyacare.demo`

The web app redirects signed-in users to their role portal. Patients can view and update their profile at `/patient/profile`, book a doctor at `/patient/book`, and view, pay for, cancel, or print appointment receipts at `/patient/appointments`. Operators can book walk-ins, record cash/UPI/card payments, and manage the day's queue from `/operator`.

## Five-minute demo

1. Sign in as `patient@aarogyacare.demo` / `Pass@1234`; open **Book appointment**, choose a specialty, doctor, and available future slot, then book it.
2. On the appointment page, pay using mock checkout. The demo records a successful payment without a gateway call; you can print the receipt.
3. Open **Urgent assistance**, submit a fictional low-severity case, and confirm the request appears in the operator emergency panel.
4. Open **Documents** and upload `apps/api/samples/fake-lab-report.pdf`. If linking a visit, choose the appointment you just booked. The worker processes it; without the worker, it remains queued.
5. Sign out and sign in as `doctor1@aarogyacare.demo`. Open **My patients** → Demo Patient → review the fictional seeded summary and lab report. The newly uploaded record also appears after processing because the doctor has an appointment relationship.
6. Sign out and sign in as `admin@aarogyacare.demo`; the **Overview** panel shows live aggregate counts. It intentionally contains no clinical record details.

All seeded patient, appointment, emergency, document, and consultation data are fictional. The demo emergency does not dispatch an ambulance.

## Phase 1 API routes

- Public, rate-limited: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- Refresh-cookie routes: `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Authenticated, any of the four roles: `GET /api/auth/me`.
- Authenticated patient only: `GET /api/patients/me/profile`, `PUT /api/patients/me/profile`.
- Authenticated admin only: `GET /api/admin/session` and `GET /api/admin/overview` (aggregate counts; no patient clinical data).
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

The seed creates five wards and thirty available beds for the demo. The patient portal has an urgent assistance form; it alerts the hospital team but does not arrange an ambulance.

## Phase 5 document pipeline

- `POST /api/documents`: authenticated patients only; accepts one PDF/JPG/PNG up to 10 MB and an optional appointment ID belonging to that patient. Returns a queued document.
- `GET /api/documents`: patients see their own documents; doctors see documents only for patients they have appointments with; admins may review all metadata.
- `GET /api/documents/:id/status`: patient owner, treating doctor, or admin.
- `GET /api/documents/:id/file`: patient owner, treating doctor, or admin. Each download is audit logged.
- `GET /api/patients/:id/search?q=`: doctor only, limited to patients they have appointments with.

The worker hashes files to detect duplicates, reads at most 10 PDF pages, runs OCR on images, applies keyword classifications, and saves simple date/medicine/lab/amount extractions with source snippets. Abnormal lab values are flagged against printed numeric ranges. Appointment-linked uploads update a plain-text visit summary. Confirm extracted data against the original document. Doctor document access is currently appointment scoped; the Consent model and revocation controls are part of Phase 6.

Three fake PDF samples (prescription, lab report, bill) and one fake lab image are included. Regenerate the PDFs with `node apps/api/samples/generate-samples.mjs`.

## Phase 6 doctor portal

- `GET /api/doctor/today`: the signed-in doctor's current-day appointments and active emergency cases, with emergencies ranked first.
- `GET /api/doctor/patients` and `GET /api/doctor/patients/:id/records`: patients seen by that doctor; record reads are audit logged and require an appointment relationship. A revoked `Consent` record denies access.
- `POST /api/consultations/:appointmentId/start` and `/end`: the assigned doctor advances a checked-in appointment to `IN_CONSULTATION`, then to `COMPLETED`. Completion emits `consultation.completed` and closes its queue entry.
- `POST /api/consultations/:appointmentId/report`: creates one diagnosis/notes/follow-up report and its medicine rows for a completed appointment. Reports have no update or delete route.

The doctor portal has today's queue, emergency cases, patient records with summary/source snippets/original files/timeline, the report form, and AVAILABLE/BUSY/AWAY controls. Patient-granted or revoked consent is enforced on doctor record access.

## Phase 7 patient portal

- `GET /api/records` and `/api/records/export`: patient-only, limited to that patient's documents, completed-visit summaries, reports, and prescriptions. Reads are audit logged; the export downloads as JSON.
- `GET|POST /api/chat/:appointmentId/messages`: patient and assigned doctor only, after the appointment is completed. Patients can send up to 20 messages per Kolkata calendar day; the page polls every five seconds and says chat is not for emergencies.
- `POST /api/feedback`: patient-only, one text response per completed appointment. Admin can hide feedback through `PATCH /api/admin/feedback/:id/hide` or manage it in Resources.
- `POST /api/appointments/:id/reschedule`: patient-only; moves an active held/confirmed appointment to an available scheduled slot in a transaction.
- `GET /api/notifications`, `POST /api/notifications/:id/read`: authenticated roles; each account only sees its own notifications. Booking payment, consultation/report completion, and document processing create notifications.
- `GET|PUT /api/consents`, `GET /api/access-history`: patient-only consent and record-access history.
- Appointments booked more than 24 hours ahead queue a delayed reminder email. The worker sends it only if the appointment is confirmed when the reminder is due.

The patient portal includes Records (document downloads and JSON export, visit reports, summary, doctor chat, feedback), Record access, and Notifications. Rescheduling is available from active appointment cards.

## Phase 8 admin panel

- `GET /api/admin/meta` returns the resource whitelist and field metadata. Admin-only generic resource routes support paginated/searchable `GET /:resource`, item reads, `POST`, `PUT`, `DELETE`, user soft-delete/restore, and `GET /:resource/export.csv`.
- Whitelisted resources: Users, Specialties, Doctor profiles, Wards, Beds, Feature flags, Feedback, Payments (read-only), and Audit log (read-only). Unknown resources return 404. Admin writes are audit logged; the current admin cannot disable their own account.
- `GET /api/admin/overview` reports appointments today, average queue wait, bed occupancy, monthly revenue, and failed document jobs. `GET /api/admin/documents/failed` and `POST /api/admin/documents/:id/retry` list and retry failed processing jobs.
- Admin **Resources** uses shared metadata-driven table and form components. Admin can create, edit, soft-delete, and restore users and create/edit/delete specialties; CSV export is available per resource.

## Checks

- Run API tests: `npm.cmd test`.
- Check lint: `npm.cmd run lint`.
- Check formatting: `npm.cmd run format:check`.
- Build the web app: `npm.cmd --workspace apps/web run build`.

The API tests use the local PostgreSQL database and seeded doctor, patient, and operator accounts. Start Docker, apply migrations, and run the seed command before `npm.cmd test`. The Phase 3 tests cover mock checkout, patient/operator access rules, receipt access, duplicate payment verification/webhooks, and all refund tiers.

## Configuration

Copy `.env.example` and set these local values as needed: `DATABASE_URL` for PostgreSQL, `REDIS_URL` for Redis, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` for local token signing, `WEB_ORIGIN` for the browser origin, and `MOCK_PAYMENTS=true` for demo checkout. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `EMERGENCY_DESK_EMAIL` configure real email delivery; leave SMTP blank for local console delivery. The `RAZORPAY_*` values are only needed to exercise Razorpay test mode. Never commit `.env`.

## Disclaimer

AarogyaCare is a college project, not a certified medical device. Machine-generated summaries are decision support only; doctors make all clinical decisions. A real deployment would need privacy and compliance review (in India: DPDP Act and ABDM guidelines).
