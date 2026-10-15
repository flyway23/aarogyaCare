# Project progress

## Phases done

- Phase 0: Foundation.
- Phase 1: Authentication, roles, audit basics, patient profile.
- Phase 2: Doctors, schedules, appointments, queue.
- Phase 3: Mock/Razorpay payments, receipts, refunds, payment email queue.
- Phase 4: Beds, reservations, assignments, live emergency alerts.
- Phase 5: Local document uploads, extraction worker, classifications, timeline, visit summaries.

## Decisions

- Windows development uses `npm.cmd` in PowerShell. Docker Compose runs PostgreSQL 16 and Redis; API, worker, and web run locally.
- Demo uses `MOCK_PAYMENTS=true`. Razorpay test mode uses REST API requests and HMAC signature verification.
- Appointment/payment confirmation is atomic and idempotent. Cancellation refunds are 100% at 24+ hours, 50% from 2 to under 24 hours, and 0% under 2 hours.
- Payment emails and emergency alerts use BullMQ workers. Without SMTP, development email output omits message bodies.
- Bed changes use row locks and PostgreSQL transactions; reservations expire after 30 minutes. Appointment holds expire after five minutes.
- Dates and schedule weekdays use Asia/Kolkata; timestamps are stored in UTC.
- Seeded demo roles share password `Pass@1234`.
- Uploaded reports are stored under ignored `apps/api/uploads/`. The `documents` queue hashes files, reads up to 10 PDF pages, OCRs images, extracts rule-based values, creates timeline events, and updates appointment summaries.
- Image OCR downloads English language data on first use and requires network access then. Extraction and summaries are demo aids; confirm findings against the original documents.
- Doctor document access is appointment scoped. Consent and revocation controls are scheduled for Phase 6.

## How to run

1. Start Docker Desktop.
2. `docker compose up -d`
3. `npm.cmd install`
4. `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`
5. `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma`
6. `npm.cmd --workspace apps/api run db:seed`
7. Start three terminals: `npm.cmd run dev:api`, `npm.cmd run dev:worker`, and `npm.cmd run dev:web`.
8. Open `http://localhost:5173`.

## Known issues

- The prompt specifies Node 20; this machine currently has Node 24.21.0.
- Latest npm install reported 6 vulnerabilities (1 moderate, 3 high, 2 critical). Review with `npm audit` before deployment.
- `prisma migrate dev` cannot create a shadow database with the configured user's permissions. Use the committed migrations with `prisma migrate deploy`.
- Doctor consent revocation is not implemented yet; it belongs to Phase 6.
- Razorpay live gateway calls need test keys and were not exercised.

## Checks

- `npm.cmd test`: 27 API tests pass, including document PDF extraction, image OCR, duplicate detection, and earlier phase route/concurrency/socket/payment cases.
- `npm.cmd run lint` and `npm.cmd run format:check` pass.
- `npm.cmd --workspace apps/web run build` passes.
- `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma` passes; all eight migrations are applied.
- `node apps/api/samples/worker-smoke.mjs` verified processing by the separate worker.

## Phase 5 route protection

- `POST /api/documents`: patient only; one PDF/JPG/PNG file up to 10 MB; optional appointment must belong to the patient.
- `GET /api/documents`: patient sees own records; doctor sees records for patients with an appointment relationship; admin can review metadata.
- `GET /api/documents/:id/status` and `/file`: owner, treating doctor, or admin. File downloads are audit logged.
- `GET /api/patients/:id/search?q=`: doctor only and appointment scoped.
- Document IDs are validated. The list endpoint does not return extracted text. Doctors have no document mutation route.

## Next phase

- Phase 6: Doctor portal. Begin after the user says `continue`.
