ALTER TABLE "JournalEntry"
  ADD COLUMN "observed" TEXT,
  ADD COLUMN "inferred" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0;

UPDATE "JournalEntry"
SET
  "observed" = COALESCE("observed", "summary"),
  "inferred" = COALESCE("inferred", '')
WHERE "observed" IS NULL OR "inferred" IS NULL;

ALTER TABLE "WeeklyReview"
  ADD COLUMN "report" JSONB,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0;

UPDATE "WeeklyReview"
SET "report" = jsonb_build_object(
  'summary', "summary",
  'strengths', "strengths",
  'prioritizedLeaks', "leaks",
  'nextActions', "actions",
  'coachProfileDelta', jsonb_build_object(
    'newRecurringLeaks', '[]'::jsonb,
    'resolvedLeaks', '[]'::jsonb,
    'adviceGiven', "actions"
  )
)
WHERE "report" IS NULL;

ALTER TABLE "CoachProfile"
  ADD COLUMN "riskProfile" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReview_tradingAccountId_periodStart_key"
  ON "WeeklyReview"("tradingAccountId", "periodStart");
