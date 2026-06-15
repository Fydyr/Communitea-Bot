-- CreateTable
CREATE TABLE "AnecdoteVote" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnecdoteVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnecdoteVote_messageId_idx" ON "AnecdoteVote"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "AnecdoteVote_messageId_userId_key" ON "AnecdoteVote"("messageId", "userId");
