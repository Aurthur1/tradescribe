ALTER TABLE "User"
  ADD COLUMN "authProviderId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

UPDATE "User"
SET "authProviderId" = COALESCE("authProviderId", 'legacy:' || "id")
WHERE "authProviderId" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "authProviderId" SET NOT NULL;

CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");
