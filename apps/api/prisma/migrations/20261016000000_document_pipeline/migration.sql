CREATE TYPE "DocumentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'BILL', 'IMAGING', 'OTHER');

CREATE TABLE "Document" (
  "id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "appointmentId" UUID,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "sha256" TEXT,
  "status" "DocumentStatus" NOT NULL DEFAULT 'QUEUED',
  "type" "DocumentType",
  "extractedText" TEXT NOT NULL DEFAULT '',
  "failReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DocumentExtraction" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sourceSnippet" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TimelineEvent" (
  "id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisitSummary" (
  "id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisitSummary_appointmentId_key" ON "VisitSummary"("appointmentId");
CREATE INDEX "Document_patientId_createdAt_idx" ON "Document"("patientId", "createdAt");
CREATE INDEX "Document_appointmentId_idx" ON "Document"("appointmentId");
CREATE INDEX "DocumentExtraction_documentId_kind_idx" ON "DocumentExtraction"("documentId", "kind");
CREATE INDEX "TimelineEvent_patientId_eventDate_idx" ON "TimelineEvent"("patientId", "eventDate");
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
