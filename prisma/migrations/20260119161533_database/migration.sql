-- CreateTable
CREATE TABLE "AnecdoteChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnecdoteChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentAnecdote" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentAnecdote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnecdoteChannel_guildId_idx" ON "AnecdoteChannel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AnecdoteChannel_guildId_channelId_key" ON "AnecdoteChannel"("guildId", "channelId");

-- CreateIndex
CREATE INDEX "SentAnecdote_title_idx" ON "SentAnecdote"("title");

-- CreateIndex
CREATE INDEX "SentAnecdote_guildId_idx" ON "SentAnecdote"("guildId");
