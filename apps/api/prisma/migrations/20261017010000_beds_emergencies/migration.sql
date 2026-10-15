CREATE TYPE "WardType" AS ENUM ('GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'EMERGENCY');
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE');
CREATE TYPE "EmergencySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "EmergencyStatus" AS ENUM ('RAISED', 'ACCEPTED', 'ADMITTED', 'CLOSED');

CREATE TABLE "Ward" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WardType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ward_name_type_key" ON "Ward"("name", "type");

CREATE TABLE "Bed" (
  "id" UUID NOT NULL,
  "wardId" UUID NOT NULL,
  "bedNumber" TEXT NOT NULL,
  "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
  "reservedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Bed_wardId_bedNumber_key" ON "Bed"("wardId", "bedNumber");
CREATE INDEX "Bed_status_reservedUntil_idx" ON "Bed"("status", "reservedUntil");

CREATE TABLE "EmergencyCase" (
  "id" UUID NOT NULL,
  "patientId" UUID,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "complaint" TEXT NOT NULL,
  "severity" "EmergencySeverity" NOT NULL,
  "location" TEXT NOT NULL,
  "status" "EmergencyStatus" NOT NULL DEFAULT 'RAISED',
  "raisedByUserId" UUID NOT NULL,
  "linkedAppointmentId" UUID,
  "acceptedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmergencyCase_linkedAppointmentId_key" ON "EmergencyCase"("linkedAppointmentId");
CREATE INDEX "EmergencyCase_status_severity_createdAt_idx" ON "EmergencyCase"("status", "severity", "createdAt");

CREATE TABLE "BedAssignment" (
  "id" UUID NOT NULL,
  "bedId" UUID NOT NULL,
  "patientId" UUID,
  "emergencyCaseId" UUID,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "assignedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BedAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BedAssignment_bedId_releasedAt_idx" ON "BedAssignment"("bedId", "releasedAt");
CREATE INDEX "BedAssignment_patientId_releasedAt_idx" ON "BedAssignment"("patientId", "releasedAt");

ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_linkedAppointmentId_fkey" FOREIGN KEY ("linkedAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_emergencyCaseId_fkey" FOREIGN KEY ("emergencyCaseId") REFERENCES "EmergencyCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
