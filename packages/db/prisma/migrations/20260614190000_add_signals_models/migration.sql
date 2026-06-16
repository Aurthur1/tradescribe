CREATE TABLE "PropFirmRuleSet" (
  "id" TEXT NOT NULL,
  "tradingAccountId" TEXT NOT NULL,
  "maxDailyLossPct" DOUBLE PRECISION,
  "maxDailyLossMode" TEXT NOT NULL DEFAULT 'balance',
  "maxDrawdownPct" DOUBLE PRECISION,
  "maxDrawdownMode" TEXT NOT NULL DEFAULT 'static',
  "profitTargetPct" DOUBLE PRECISION,
  "consistencyMaxDailyProfitPct" DOUBLE PRECISION,
  "alertThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PropFirmRuleSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeakFlag" (
  "id" TEXT NOT NULL,
  "tradingAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "tradeIds" TEXT[],
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "evidence" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeakFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tradingAccountId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'in_app',
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropFirmRuleSet_tradingAccountId_key" ON "PropFirmRuleSet"("tradingAccountId");
CREATE INDEX "LeakFlag_tradingAccountId_type_createdAt_idx" ON "LeakFlag"("tradingAccountId", "type", "createdAt");
CREATE INDEX "Alert_userId_createdAt_idx" ON "Alert"("userId", "createdAt");

ALTER TABLE "PropFirmRuleSet"
  ADD CONSTRAINT "PropFirmRuleSet_tradingAccountId_fkey"
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeakFlag"
  ADD CONSTRAINT "LeakFlag_tradingAccountId_fkey"
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Alert"
  ADD CONSTRAINT "Alert_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
