CREATE TABLE "ConsultationReport" (
  "id" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "doctorId" UUID NOT NULL,
  "diagnosis" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "followUpDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultationReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Prescription" (
  "id" UUID NOT NULL,
  "consultationReportId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "medicine" TEXT NOT NULL,
  "dosage" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Consent" (
  "id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "doctorId" UUID NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationReport_appointmentId_key" ON "ConsultationReport"("appointmentId");
CREATE INDEX "Prescription_patientId_createdAt_idx" ON "Prescription"("patientId", "createdAt");
CREATE INDEX "Prescription_consultationReportId_idx" ON "Prescription"("consultationReportId");
CREATE UNIQUE INDEX "Consent_patientId_doctorId_key" ON "Consent"("patientId", "doctorId");
CREATE INDEX "Consent_doctorId_revokedAt_idx" ON "Consent"("doctorId", "revokedAt");
ALTER TABLE "ConsultationReport" ADD CONSTRAINT "ConsultationReport_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationReport" ADD CONSTRAINT "ConsultationReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationReport" ADD CONSTRAINT "ConsultationReport_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_consultationReportId_fkey" FOREIGN KEY ("consultationReportId") REFERENCES "ConsultationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
