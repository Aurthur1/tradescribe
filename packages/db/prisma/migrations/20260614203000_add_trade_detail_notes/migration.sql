ALTER TABLE "TradeNote" ADD COLUMN "emotionTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "TradeScreenshot" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "filename" TEXT,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TradeScreenshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeScreenshot_tradeId_createdAt_idx" ON "TradeScreenshot"("tradeId", "createdAt");

ALTER TABLE "TradeScreenshot"
  ADD CONSTRAINT "TradeScreenshot_tradeId_fkey"
  FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
