-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "newsHours" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "NewsChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentNews" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "runDate" TEXT NOT NULL,
    "slotHour" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsChannel_guildId_idx" ON "NewsChannel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsChannel_guildId_channelId_key" ON "NewsChannel"("guildId", "channelId");

-- CreateIndex
CREATE INDEX "SentNews_guildId_sentAt_idx" ON "SentNews"("guildId", "sentAt");

-- CreateIndex
CREATE INDEX "NewsRun_status_nextAttemptAt_idx" ON "NewsRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsRun_guildId_runDate_slotHour_key" ON "NewsRun"("guildId", "runDate", "slotHour");
