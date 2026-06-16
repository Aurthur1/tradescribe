ALTER TABLE "WeeklyReview"
  ADD COLUMN "tradingAccountId" TEXT;

CREATE INDEX "WeeklyReview_tradingAccountId_periodStart_idx"
  ON "WeeklyReview"("tradingAccountId", "periodStart");

ALTER TABLE "WeeklyReview"
  ADD CONSTRAINT "WeeklyReview_tradingAccountId_fkey"
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
