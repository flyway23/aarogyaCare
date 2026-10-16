# AarogyaCare — Master Build Prompt (College Project Edition)

You are a careful full-stack engineer. Build **AarogyaCare**, a hospital management web app, for a **college project demo** (not production). Build it **one phase at a time**.

## 0. HOW YOU MUST WORK (read first, follow always)

1. **Work on ONE phase at a time.** Never start the next phase until I reply "continue".
2. **Keep memory in a file.** Create `PROGRESS.md` at the repo root. After every phase, update it with: phases done, decisions made, how to run, known issues, next phase. At the start of every session, read `PROGRESS.md` and this prompt first.
3. **Small steps.** Create a few files, then RUN the app/tests. Fix errors before writing more. Never write 20 files and hope they work.
4. **Never invent.** Do not use packages, functions, or API options you are not sure exist. If unsure, check the package docs or `node_modules` before using. Use only the packages listed in Section 2.
5. **No placeholders.** No `// TODO`, no "implement later", no fake functions that return nothing. If something is out of scope, leave it out completely and add it to `BACKLOG.md`.
6. **Do not make your own big decisions.** Everything is decided in this prompt. If something is truly missing, ask me ONE short question and wait.
7. **End of every phase, reply with exactly:**
   - What was built (max 6 bullets)
   - How to run it (exact commands)
   - How to test it (exact commands + 3–5 manual checks I can click through)
   - Known issues (if any)
   - What is next
8. **Self-check before saying a phase is done:** run the app from a clean start (`docker compose up -d`, migrate, seed, start). Run the tests. Hit each endpoint of the phase at least once. If anything fails, fix it first.
9. **Git:** commit at the end of each phase with message `phase-N: <name>`.

## 1. PRODUCT (what we are building)

Hospital app where:
- Patients book doctor appointments online and pay.
- Operators book for walk-in patients and manage the queue and beds.
- Emergencies are escalated instantly with a live alert.
- Beds are tracked like inventory.
- Uploaded old medical reports are processed in the background into a short summary for the doctor.

**Roles (exactly 4):** `patient`, `doctor`, `operator`, `admin`.

**Fixed scope decisions:**
- **Single hospital only.** No multi-hospital, no `hospital_id`.
- One React app with role-based routes and a different layout per role.
- Backend is a modular monolith: one folder per feature.
- College project: simple and working beats complete and fancy. No performance tuning, no compliance work.

## 2. TECH STACK (fixed — do not change or add)

| Part | Use |
|---|---|
| Frontend | React 18 (JavaScript/JSX), Vite, React Router, TanStack Query, Tailwind CSS, React Hook Form, Zod, axios, socket.io-client |
| Backend | Node.js 20, Express 4, ES modules (`"type": "module"`), async/await |
| Database | PostgreSQL 16 with **Prisma** ORM (migrations + seed) |
| Queue | Redis + BullMQ (worker is a separate process: `apps/api/src/worker.js`) |
| Auth | JWT access token (15 min) + refresh token (httpOnly cookie, 7 days), `bcryptjs` for passwords |
| Validation | Zod on every request body/query |
| Realtime | Socket.IO (only for: emergency alerts, bed counts, queue updates) |
| Payments | Razorpay **test mode**, with a `MOCK_PAYMENTS=true` switch that skips Razorpay and marks payment paid (for demo without keys) |
| Email | Nodemailer. In dev, if no SMTP is set, print emails to the console |
| File storage | **Local disk** folder `apps/api/uploads/` (not S3). Save metadata + path in Postgres |
| Document reading | `pdf-parse` for text PDFs, `tesseract.js` for images. Rule-based classification and extraction (regex/keywords). **No LLM, no Textract, no pgvector** |
| Search | PostgreSQL full-text search (`ILIKE` is fine) over extracted text |
| Security basics | `helmet`, `cors` (allow-list from env), `express-rate-limit` on auth routes |
| Testing | Vitest + Supertest (API only) |
| Code quality | ESLint + Prettier |
| DevOps | `docker-compose.yml` with **postgres and redis only**. API, worker and web run locally with npm. `.env.example` committed |

Do not add any other library without asking me.

## 3. REPO STRUCTURE (create exactly this)

```
aarogyacare/
  PROGRESS.md
  BACKLOG.md
  README.md
  docker-compose.yml
  .env.example
  package.json              (npm workspaces: apps/*)
  apps/
    api/
      package.json
      prisma/schema.prisma
      prisma/seed.js
      src/
        server.js           (starts HTTP + Socket.IO)
        app.js              (express app, middleware, route mounting)
        worker.js           (BullMQ worker process)
        config/env.js       (reads + validates env with Zod)
        lib/                (prisma.js, redis.js, queue.js, mailer.js, socket.js, eventBus.js, asyncHandler.js, httpError.js, respond.js)
        middleware/         (auth.js, requireRole.js, validate.js, errorHandler.js, audit.js)
        modules/
          auth/ users/ doctors/ appointments/ queue/ payments/
          beds/ emergency/ documents/ consultations/ chat/
          feedback/ notifications/ admin/
          (each module: routes.js, controller.js, service.js, schema.js, <name>.test.js)
      uploads/              (gitignored)
    web/
      package.json
      src/
        main.jsx, App.jsx
        api/ (axios client + one file per module)
        auth/ (AuthContext, ProtectedRoute)
        layouts/ (PatientLayout, DoctorLayout, OperatorLayout, AdminLayout)
        pages/ (patient/, doctor/, operator/, admin/, public/)
        components/ (shared UI: Table, Modal, FormField, Spinner, Toast)
```

## 4. CODE RULES (these prevent most bugs — follow strictly)

**Backend**
1. ES modules only. Always write the **file extension** in relative imports: `import x from './x.js'`.
2. Layering: `routes.js` → `controller.js` (reads req, calls service, sends response) → `service.js` (business logic + Prisma). Controllers contain no business logic.
3. Wrap every async route handler in `asyncHandler`. Never leave a promise unhandled.
4. Throw `new HttpError(status, message)` for expected errors. One central `errorHandler` turns errors into JSON.
5. **Every response uses the same shape:**
   - success: `{ "success": true, "data": ... }`
   - error: `{ "success": false, "message": "..." }`
6. Validate every request body/query with a Zod schema using the `validate` middleware. Never trust `req.body` directly.
7. Auth: `auth` middleware reads `Authorization: Bearer <token>` and sets `req.user = { id, role }`. `requireRole('doctor','admin')` guards routes. Every non-public route must have both.
8. Never return `passwordHash`. Never log passwords, tokens, or medical text.
9. Use Prisma **transactions** (`prisma.$transaction`) for: booking a slot, assigning a bed, confirming payment. Use unique constraints in the DB as the final safety net (e.g. unique on `doctorId + slotStart`).
10. Config comes only from `config/env.js`. Never read `process.env` anywhere else.
11. Modules must not import another module's repository/Prisma queries. They call that module's `service.js` or listen to events on `eventBus`.
12. Event bus: simple Node `EventEmitter` wrapper. Events: `appointment.booked`, `payment.paid`, `emergency.raised`, `bed.updated`, `document.uploaded`, `document.processed`, `consultation.completed`. Emails, notifications and socket pushes subscribe to events.
13. Background work (emails, document processing) goes through BullMQ, never inside the request handler.
14. Audit log: write a row (`userId`, `action`, `entity`, `entityId`, `ip`, `createdAt`) whenever someone reads or writes a **patient's medical data** (documents, summaries, consultation reports) and on every admin write.

**Frontend**
1. One axios instance. It attaches the access token and, on a 401, calls `/api/auth/refresh` once, then retries the request.
2. Use TanStack Query for all server data. No fetching inside random `useEffect`s.
3. Every form uses React Hook Form + a Zod schema.
4. Every page must handle three states: loading, error, empty.
5. `ProtectedRoute` checks login and role. Each role's pages are lazy-loaded with `React.lazy`.
6. Tailwind only; mobile-first (patients use phones). No UI library.
7. Show errors to the user with a simple toast. Never leave a button that does nothing.

**General**
- Names: files `camelCase.js`, React components `PascalCase.jsx`, DB tables via Prisma models in `PascalCase`.
- Add JSDoc (`@param`, `@returns`) on service functions. Keep functions short.
- Write tests for: each phase's main happy path + each **permission check** (wrong role gets 403).

## 5. DATA MODEL (Prisma — build progressively, a few models per phase)

All models: `id` (UUID, default `uuid()`), `createdAt`, `updatedAt`. Add `deletedAt DateTime?` only where marked (soft delete).

- **User**: email (unique), passwordHash, name, phone, role (enum), isActive, deletedAt
- **PatientProfile**: userId (unique), dob, gender, bloodGroup, allergies (text), emergencyContactName, emergencyContactPhone
- **Specialty**: name (unique)
- **DoctorProfile**: userId (unique), specialtyId, feeInr (Int), bio, avgConsultMinutes (Int default 15), status (enum: AVAILABLE, BUSY, AWAY)
- **DoctorSchedule**: doctorId, weekday (0–6), startTime ("09:00"), endTime ("13:00"), slotMinutes (Int default 15)
- **DoctorLeave**: doctorId, date
- **Appointment**: patientId, doctorId, slotStart (DateTime), slotEnd, status (enum: HELD, CONFIRMED, CHECKED_IN, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW), reason, heldUntil (DateTime?), bookedByUserId, isEmergency (Bool). **Unique:** (doctorId, slotStart) where status is active — enforce by checking inside a transaction + unique index on (doctorId, slotStart, activeFlag) or simply a partial check in the transaction.
- **QueueEntry**: appointmentId (unique), doctorId, date, position (Int), status (WAITING, IN_PROGRESS, DONE, SKIPPED), reorderReason
- **Payment**: appointmentId, amountInr, method (RAZORPAY, CASH, UPI, CARD), status (CREATED, PAID, FAILED, REFUNDED), razorpayOrderId, razorpayPaymentId (unique, nullable), receiptNo (unique)
- **Refund**: paymentId, amountInr, reason, status
- **Ward**: name, type (enum: GENERAL, PRIVATE, SEMI_PRIVATE, ICU, EMERGENCY)
- **Bed**: wardId, bedNumber, status (enum: AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE), reservedUntil (DateTime?). Unique (wardId, bedNumber)
- **BedAssignment**: bedId, patientId (nullable), emergencyCaseId (nullable), assignedAt, releasedAt (nullable), assignedByUserId
- **EmergencyCase**: patientId (nullable), name, phone, complaint, severity (enum: LOW, MEDIUM, HIGH, CRITICAL), location, status (enum: RAISED, ACCEPTED, ADMITTED, CLOSED), raisedByUserId, linkedAppointmentId (nullable), acceptedByUserId (nullable)
- **Document**: patientId, uploadedByUserId, originalName, storedPath, mimeType, sizeBytes, fileHash, status (enum: QUEUED, PROCESSING, READY, FAILED), failReason, docType (nullable: PRESCRIPTION, LAB_REPORT, DISCHARGE_SUMMARY, BILL, IMAGING, OTHER), extractedText (text), appointmentId (nullable). Unique (patientId, fileHash)
- **DocumentExtraction**: documentId, fieldName, fieldValue, sourceSnippet, confidence (Float)
- **TimelineEvent**: patientId, documentId, eventDate, title, details
- **VisitSummary**: appointmentId (unique), patientId, content (text), generatedAt. Always shown with label "Machine-generated – verify with original documents".
- **ConsultationReport**: appointmentId (unique), doctorId, patientId, diagnosis, notes, followUpDate. **Create-only; never updated or deleted.**
- **Prescription**: reportId, medicine, dose, frequency, durationDays
- **ChatThread**: appointmentId (unique), patientId, doctorId
- **ChatMessage**: threadId, senderId, text
- **Feedback**: appointmentId, patientId, text, isHidden (Bool default false)
- **Notification**: userId, title, body, readAt (nullable)
- **AuditLog**: userId (nullable), action, entity, entityId, ip, createdAt
- **FeatureFlag**: key (unique), enabled (Bool)
- **Consent**: patientId, doctorId, grantedAt, revokedAt (nullable)

## 6. PHASES

Each phase ends with the "end of phase reply" from Section 0. Each phase has a **Done when** checklist — do not finish until every line is true.

### Phase 0 — Foundation
Build: npm workspaces, `docker-compose.yml` (postgres, redis), `.env.example`, `config/env.js`, Express app with helmet/cors/JSON parsing/`errorHandler`, `asyncHandler`, `HttpError`, `respond` helpers, event bus, Prisma setup with an empty first migration, `GET /api/health` (checks DB + Redis), Vite React app that shows "AarogyaCare" and calls `/api/health`, ESLint + Prettier, one Vitest test for health.
**Done when:** `docker compose up -d`, `npm run dev:api`, `npm run dev:web` all work; health endpoint returns `{success:true}`; `npm test` passes.

### Phase 1 — Auth, roles, audit
Models: User, PatientProfile, AuditLog, FeatureFlag.
Endpoints:
- `POST /api/auth/register` (patient only), `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (token printed to console email)
- `GET/PUT /api/patients/me/profile`
Also: `auth` + `requireRole` middleware, audit service, seed script creating 1 admin, 2 doctors, 1 operator, 1 patient (password `Pass@1234`, print them in the seed output).
Frontend: login, register, role-based redirect after login, the 4 empty layouts with a navbar, `ProtectedRoute`.
**Done when:** each seeded role can log in and lands on its own layout; patient cannot open `/admin` (frontend redirect AND API returns 403); tests cover login, wrong password, 403 on wrong role, refresh flow.

### Phase 2 — Doctors, slots, appointments, queue
Models: Specialty, DoctorProfile, DoctorSchedule, DoctorLeave, Appointment, QueueEntry.
Endpoints:
- `GET /api/specialties`, `GET /api/doctors?specialtyId=`, `GET /api/doctors/:id`
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` → generated from schedule minus leave minus booked/held slots
- `GET /api/doctors/:id/queue-info?date=` → `{ patientsAhead, estimatedWaitMinRange: [low, high] }` where estimate = patientsAhead × avgConsultMinutes, low = 0.8×, high = 1.3×; if doctor status is BUSY/AWAY add 15 min to both
- `POST /api/appointments` (patient: books for self; operator: books for a patient, creating the patient if the phone is new, and checking duplicates by phone) → creates status HELD with `heldUntil = now + 5 min`, inside a transaction that fails with 409 if the slot is taken
- `POST /api/appointments/:id/confirm` (internal use by payments; operators can confirm cash bookings)
- `POST /api/appointments/:id/cancel`, `POST /api/appointments/:id/check-in`
- Doctor-only: `PUT /api/doctors/me/schedule`, `POST /api/doctors/me/leave`, `PUT /api/doctors/me/status`
- Operator queue: `GET /api/queue?doctorId=&date=`, `POST /api/queue/:id/no-show`, `POST /api/queue/:id/skip`, `POST /api/queue/:id/reorder` (requires a reason)
Expired HELD appointments: a small `setInterval` job (every minute) cancels them. This is a simple release; no Redis lock needed.
Frontend: patient booking wizard (specialty → doctor → date/slot with wait estimate), my appointments list; operator walk-in booking form and queue screen.
**Done when:** two simultaneous bookings of the same slot → exactly one succeeds (test this with `Promise.all`); expired holds are released; wait estimate shows a range.

### Phase 3 — Payments
Models: Payment, Refund.
Endpoints:
- `POST /api/payments/create-order` (for a HELD appointment) → Razorpay order (or mock order if `MOCK_PAYMENTS=true`)
- `POST /api/payments/verify` (checks Razorpay signature using HMAC SHA256 with the key secret) → marks PAID and confirms the appointment in one transaction
- `POST /api/payments/webhook` (verify signature; **idempotent**: if payment already PAID, return 200 and do nothing)
- `POST /api/payments/offline` (operator: CASH/UPI/CARD) → PAID + confirm
- `POST /api/payments/:id/refund` (refund rule: cancelled ≥ 24h before = 100%, 2–24h = 50%, <2h = 0%)
- `GET /api/payments/:id/receipt` → HTML receipt page (printable; no PDF library)
Emit `payment.paid`; a subscriber queues a confirmation email.
**Done when:** full online booking works end-to-end in mock mode; calling verify/webhook twice does not double-process; refund amounts follow the rule; tests cover all three.

### Phase 4 — Beds and emergency
Models: Ward, Bed, BedAssignment, EmergencyCase.
Endpoints:
- Operator/admin: `GET /api/beds` (grouped by ward type with counts: total, available, occupied, reserved, cleaning), `POST /api/beds/:id/assign`, `POST /api/beds/:id/release` (→ CLEANING), `POST /api/beds/:id/status`, `POST /api/beds/:id/reserve` (expires in 30 min)
- All bed changes inside a transaction that re-reads the bed row first and rejects invalid transitions (e.g. cannot assign an OCCUPIED bed → 409). Emit `bed.updated` → push new counts through Socket.IO to room `staff`.
- `POST /api/emergency` (patient or operator; minimal fields; no payment) → creates case, emits `emergency.raised`
- `POST /api/emergency/:id/accept`, `POST /api/emergency/:id/reserve-bed`, `POST /api/emergency/:id/close`
- `POST /api/appointments/:id/escalate` (operator) → creates EmergencyCase linked to the appointment
- `GET /api/emergency` (staff; CRITICAL first)
`emergency.raised` subscribers: (1) Socket.IO alert to room `staff`, (2) email to the emergency desk address from env (via queue).
Socket.IO auth: verify the JWT on connection; only operator/doctor/admin join `staff`.
Frontend: operator bed board with live counts, emergency dashboard with a live alert banner + sound-free visual flash, emergency form for patients.
**Done when:** two operators assigning the same bed → one gets 409; a raised emergency appears on an open operator screen within 2 seconds without refresh; escalation keeps the link to the original appointment.

### Phase 5 — Document pipeline
Models: Document, DocumentExtraction, TimelineEvent, VisitSummary.
Endpoints:
- `POST /api/documents` (multipart via `multer`; PDF/JPG/PNG only, max 10 MB; patient uploads for self, optional `appointmentId`) → saves file, creates row QUEUED, adds BullMQ job
- `GET /api/documents` (patient: own; doctor: only patients they have appointments with and consent not revoked), `GET /api/documents/:id/file` (streams file after permission check + audit log)
- `GET /api/documents/:id/status`
- `GET /api/patients/:id/search?q=` (doctor; searches extractedText and extraction values)
Worker (single queue `documents`, one job runs these steps in order, updating `status`):
1. **Ingest**: compute SHA-256; if the same patient already has this hash → mark FAILED with reason "duplicate".
2. **Read text**: PDF → `pdf-parse`; image → `tesseract.js`. Limit to the first 10 pages.
3. **Classify** (keyword rules): "rx"/"tablet"/"capsule" → PRESCRIPTION; "hemoglobin"/"reference range"/"hba1c" → LAB_REPORT; "discharge" → DISCHARGE_SUMMARY; "invoice"/"total amount"/"bill" → BILL; "x-ray"/"mri"/"ct scan"/"ultrasound" → IMAGING; else OTHER.
4. **Extract** (regex rules, keep each simple): dates, medicines+doses (lines with mg/ml), lab lines (`name value unit range`), total amount for bills. Save each as a DocumentExtraction with the `sourceSnippet` (the matching line). Mark lab values outside the printed range as abnormal.
5. **Timeline**: create TimelineEvent rows from the dated items.
6. **Summary**: when an appointment exists, build a plain-text template summary (conditions/diagnoses found, current medicines, allergies from profile, abnormal labs). Always include the line "Machine-generated – verify with original documents".
Retries: BullMQ `attempts: 3`, exponential backoff. After final failure set status FAILED with `failReason`.
Frontend: patient upload component on the booking page and a "My documents" page with status badges (Queued/Processing/Ready/Failed).
**Done when:** uploading a sample text PDF and a sample image produces classified extractions and a timeline; re-uploading the same file is rejected as duplicate; the worker running as a separate process is what does the work (the API does not).
Create 3 sample files in `apps/api/samples/` (a fake prescription, a fake lab report, a fake bill) for testing and the demo.

### Phase 6 — Doctor portal
Models: ConsultationReport, Prescription, Consent.
Endpoints:
- `GET /api/doctor/today` (today's queue with emergency cases pinned on top)
- `GET /api/doctor/patients` (everyone they have treated) and `GET /api/doctor/patients/:id/records` (profile, documents, extractions, timeline, latest summary; audit-logged)
- `POST /api/consultations/:appointmentId/start` and `/end` (status IN_CONSULTATION → COMPLETED; emits `consultation.completed`)
- `POST /api/consultations/:appointmentId/report` (diagnosis, notes, followUpDate, medicines[]) — **create only, once per appointment. No PUT/PATCH/DELETE routes exist for reports, documents, extractions or patient profiles for the doctor role.**
Frontend: doctor queue page, patient detail page showing the summary (with the machine-generated label) side by side with original documents and extraction snippets, report/prescription form, availability + busy/away toggle.
**Done when:** a test proves a doctor token gets 403/404 on any attempt to modify documents or profiles; a doctor can only see patients they have an appointment with; report can't be submitted twice.

### Phase 7 — Patient portal completion
Models: ChatThread, ChatMessage, Feedback, Notification.
Endpoints:
- `GET /api/records` (own reports/prescriptions/documents), `GET /api/records/export` (own data as one JSON file)
- Chat: `GET/POST /api/chat/:appointmentId/messages` (only after consultation COMPLETED; max 20 messages/day per patient; UI shows "Chat is not for emergencies"). Use polling every 5 seconds in the UI.
- `POST /api/feedback` (text only, after COMPLETED), admin hides via `PATCH /api/feedback/:id/hide`
- `POST /api/appointments/:id/reschedule` (cancel + rebook on a new slot in one transaction, same refund rule as cancel when fee changes does not apply — simply move the booking)
- `GET /api/notifications`, `POST /api/notifications/:id/read` (created by event subscribers: booking confirmed, payment received, report ready, document processed)
- Consent: `GET/PUT /api/consents`, `GET /api/access-history` (patient sees AuditLog entries about their own records)
- Appointment reminder: a BullMQ delayed job queues an email 24h before the slot.
**Done when:** patient can view/download records, chat after a consultation, leave feedback, reschedule, see notifications, and see who accessed their records.

### Phase 8 — Admin panel
Build a **config-driven generic CRUD** for a whitelist of models only: User, Specialty, DoctorProfile, Ward, Bed, FeatureFlag, Feedback, Payment (read-only), AuditLog (read-only).
- One config file `admin/resources.js` describing for each resource: model name, list of columns, searchable fields, editable fields with types, whether read-only.
- Generic endpoints: `GET /api/admin/:resource` (page, pageSize, search, sort), `GET /api/admin/:resource/:id`, `POST`, `PUT`, `DELETE` (soft delete where `deletedAt` exists), `POST /api/admin/:resource/:id/restore`, `GET /api/admin/:resource/export.csv`.
- Reject any resource not in the whitelist with 404. Admin-only. Every write is audit-logged.
- One reusable React `DataTable` + `ResourceForm` that render from the same config (served by `GET /api/admin/meta`).
- Dashboard page with simple numbers (no chart library; plain cards): appointments today, average wait, bed occupancy %, revenue this month, failed document jobs.
- Page listing failed document jobs with a "Retry" button.
**Done when:** admin can create/edit/soft-delete/restore a Specialty and a User from the UI without any resource-specific code; non-admin gets 403; CSV export downloads.

### Phase 9 — Polish and demo
- Seed realistic demo data (10 doctors, 3 specialties, 30 beds across ward types, a few appointments, emergencies, documents).
- `README.md`: project overview, architecture (a simple ASCII diagram), setup steps, env vars, seeded logins, how to run tests, and a **5-minute demo script** (booking → payment → emergency alert → document upload → doctor summary → admin panel).
- Basic e2e checks for the main flow using Supertest (no Playwright).
- Cleanup: remove unused code, run ESLint/Prettier, make sure a fresh clone works by following the README only.
- Add the disclaimer below to the README and as a footer in the app.
**Done when:** a fresh clone, following only the README, reaches a working demo.

## 7. ALWAYS-ON RULES FOR SAFETY
- Patient data: a patient sees only their own data; a doctor sees only patients they have appointments with; operators see no clinical notes/summaries/documents; only admin sees everything.
- Every route must have an auth check and a role check. Before finishing each phase, list all routes and confirm each one is protected correctly.
- Passwords hashed, tokens never logged, no secrets in git.

## 8. COMMON MISTAKES TO AVOID (checklist before each "done")
- Missing `.js` in imports → app crashes at start.
- Forgot `await` on Prisma calls or inside `asyncHandler`.
- Returning different JSON shapes from different endpoints.
- Frontend calling an endpoint that doesn't exist or has a different path/field name than the backend. **Always open the backend schema file and match field names exactly.**
- Timezone bugs: store all times in UTC; display in the browser's local time; slot dates are interpreted in `Asia/Kolkata`.
- Date-only values compared as strings vs Date objects.
- Leaving test data or console.logs of sensitive data.
- Changing code from an earlier phase without telling me. If you must change it, say what and why in the phase summary.

## 9. BEFORE YOU START
Do NOT start coding yet. First:
1. Reply with a 5-line summary of what you understood.
2. Ask me at most **3** questions, only if truly needed (everything else is already decided). Suggested ones: (a) Windows, Mac or Linux? (b) Do I have Docker installed? (c) Do I have Razorpay test keys or should we use `MOCK_PAYMENTS=true`?
3. Wait for my answers, then begin **Phase 0** only.

## 10. DISCLAIMER (add to README and app footer)
AarogyaCare is a college project, not a certified medical device. Machine-generated summaries are decision support only; doctors make all clinical decisions. A real deployment would need privacy and compliance review (in India: DPDP Act and ABDM guidelines).