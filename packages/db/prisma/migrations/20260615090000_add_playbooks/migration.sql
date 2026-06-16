CREATE TABLE "Playbook" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rules" JSONB NOT NULL,
  "tags" TEXT[] NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#3B82F6',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Playbook_userId_idx" ON "Playbook"("userId");

ALTER TABLE "Playbook"
ADD CONSTRAINT "Playbook_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trade"
ADD COLUMN "playbookId" TEXT;

CREATE INDEX "Trade_playbookId_idx" ON "Trade"("playbookId");

ALTER TABLE "Trade"
ADD CONSTRAINT "Trade_playbookId_fkey"
FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradeNote"
ADD COLUMN "playbookChecklist" JSONB;
