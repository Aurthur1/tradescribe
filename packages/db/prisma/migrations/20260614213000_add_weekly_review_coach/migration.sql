CREATE TABLE "WeeklyReview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "summary" TEXT NOT NULL,
  "strengths" JSONB NOT NULL,
  "leaks" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goals" JSONB NOT NULL,
  "recurringLeaks" JSONB NOT NULL,
  "riskProfileSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdviceLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "weekStart" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdviceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyReview_userId_periodStart_idx" ON "WeeklyReview"("userId", "periodStart");
CREATE INDEX "WeeklyReview_userId_createdAt_idx" ON "WeeklyReview"("userId", "createdAt");
CREATE UNIQUE INDEX "CoachProfile_userId_key" ON "CoachProfile"("userId");
CREATE INDEX "AdviceLog_userId_createdAt_idx" ON "AdviceLog"("userId", "createdAt");

ALTER TABLE "WeeklyReview"
  ADD CONSTRAINT "WeeklyReview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachProfile"
  ADD CONSTRAINT "CoachProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdviceLog"
  ADD CONSTRAINT "AdviceLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
