-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "quizHours" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "AnecdoteMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnecdoteMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnecdoteMessage_messageId_key" ON "AnecdoteMessage"("messageId");

-- CreateIndex
CREATE INDEX "AnecdoteMessage_guildId_idx" ON "AnecdoteMessage"("guildId");
