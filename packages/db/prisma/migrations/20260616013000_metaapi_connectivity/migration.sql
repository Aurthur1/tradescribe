ALTER TYPE "ConnectionStatus" RENAME TO "ConnectionStatus_old";

CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'PROVISIONING', 'SYNCING', 'CONNECTED', 'DEGRADED', 'DISCONNECTED');

ALTER TABLE "BrokerConnection"
  ADD COLUMN "platform" "TradingPlatform",
  ADD COLUMN "broker" TEXT,
  ADD COLUMN "server" TEXT,
  ADD COLUMN "login" TEXT,
  ADD COLUMN "metaApiAccountId" TEXT,
  ADD COLUMN "lastError" TEXT;

ALTER TABLE "BrokerConnection"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ConnectionStatus"
  USING (
    CASE "status"::text
      WHEN 'ERROR' THEN 'DEGRADED'
      WHEN 'SYNCING' THEN 'SYNCING'
      WHEN 'CONNECTED' THEN 'CONNECTED'
      WHEN 'DISCONNECTED' THEN 'DISCONNECTED'
      ELSE 'PENDING'
    END
  )::"ConnectionStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "ConnectionStatus_old";

UPDATE "BrokerConnection" bc
SET
  "broker" = COALESCE(bc."broker", bc."provider"),
  "platform" = ta."platform",
  "login" = ta."login"
FROM "TradingAccount" ta
WHERE ta."brokerConnectionId" = bc."id";

ALTER TABLE "TradingAccount"
  ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "propFirm" TEXT;

ALTER TABLE "Trade"
  ADD COLUMN "brokerTimeZone" TEXT;

UPDATE "Trade"
SET "externalId" = "id"
WHERE "externalId" IS NULL OR "externalId" = '';

ALTER TABLE "Trade"
  ALTER COLUMN "externalId" SET NOT NULL;

CREATE UNIQUE INDEX "BrokerConnection_metaApiAccountId_key" ON "BrokerConnection"("metaApiAccountId");
