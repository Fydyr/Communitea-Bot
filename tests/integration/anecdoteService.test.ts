import { describe, it, expect, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { AnecdoteService } from "../../src/services/AnecdoteService";

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

async function seedTrackedMessage(messageId: string, guildId = "g1") {
  await prisma.anecdoteMessage.create({
    data: { guildId, channelId: "c1", messageId, title: "Titre", language: "fr" },
  });
}

describe("AnecdoteService.applyVote", () => {
  it("enregistre un vote positif et incrémente le compteur", async () => {
    await seedTrackedMessage("m1");
    const result = await AnecdoteService.applyVote("m1", "u1", 1);
    expect(result).toEqual({ upvotes: 1, downvotes: 0 });
  });

  it("bascule (annule) le vote si l'utilisateur reclique le même", async () => {
    await seedTrackedMessage("m1");
    await AnecdoteService.applyVote("m1", "u1", 1);
    const result = await AnecdoteService.applyVote("m1", "u1", 1);
    expect(result).toEqual({ upvotes: 0, downvotes: 0 });
  });

  it("change la valeur si l'utilisateur vote dans l'autre sens", async () => {
    await seedTrackedMessage("m1");
    await AnecdoteService.applyVote("m1", "u1", 1);
    const result = await AnecdoteService.applyVote("m1", "u1", -1);
    expect(result).toEqual({ upvotes: 0, downvotes: 1 });
  });

  it("renvoie null pour un message non suivi", async () => {
    const result = await AnecdoteService.applyVote("inconnu", "u1", 1);
    expect(result).toBeNull();
  });
});

describe("AnecdoteService.getHistoryPage", () => {
  it("pagine et trie par date décroissante", async () => {
    await prisma.anecdoteMessage.create({
      data: { guildId: "g1", channelId: "c1", messageId: "old", title: "Ancien", language: "fr", sentAt: new Date("2026-01-01") },
    });
    await prisma.anecdoteMessage.create({
      data: { guildId: "g1", channelId: "c1", messageId: "new", title: "Récent", language: "fr", sentAt: new Date("2026-02-01") },
    });

    const page = await AnecdoteService.getHistoryPage("g1", 0, 1);
    expect(page.total).toBe(2);
    expect(page.pages).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe("Récent");
  });
});
