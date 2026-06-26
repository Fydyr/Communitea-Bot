-- CreateTable
CREATE TABLE IF NOT EXISTS "SentQuiz" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SentQuiz_guildId_idx" ON "SentQuiz"("guildId");
