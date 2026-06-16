ALTER TABLE "User"
  ADD COLUMN "avatarUrl" TEXT;

ALTER TABLE "UserPreference"
  ADD COLUMN "notificationPreferences" JSONB,
  ADD COLUMN "displayCurrencyAccountId" TEXT,
  ADD COLUMN "timeZone" TEXT;
