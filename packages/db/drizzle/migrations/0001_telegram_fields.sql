ALTER TABLE "User" ADD COLUMN "hasTelegram" boolean DEFAULT false NOT NULL;
ALTER TABLE "User" ADD COLUMN "pointsAwardedForTelegram" boolean DEFAULT false NOT NULL;
ALTER TABLE "User" ADD COLUMN "telegramId" text;
ALTER TABLE "User" ADD COLUMN "telegramUsername" text;
ALTER TABLE "User" ADD COLUMN "telegramLinkedAt" timestamp;
ALTER TABLE "User" ADD CONSTRAINT "User_telegramId_unique" UNIQUE("telegramId");
