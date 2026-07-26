import { describe, it, expect, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { LevelService, XP_QUIZ, XP_QUIZ_CORRECT_BONUS } from "../../src/services/LevelService";

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe("LevelService.award", () => {
  it("crée un XpEvent et met à jour les stats", async () => {
    const result = await LevelService.award("g1", "u1", "quiz", "msg-1", { correct: true });

    expect(result).not.toBeNull();
    expect(result!.xp).toBe(XP_QUIZ + XP_QUIZ_CORRECT_BONUS);

    const stats = await prisma.userStats.findUnique({
      where: { guildId_userId: { guildId: "g1", userId: "u1" } },
    });
    expect(stats!.xp).toBe(XP_QUIZ + XP_QUIZ_CORRECT_BONUS);
    expect(stats!.quizCorrect).toBe(1);
  });

  it("est idempotent pour un même refId", async () => {
    const first = await LevelService.award("g1", "u1", "quiz", "msg-1", { correct: false });
    const second = await LevelService.award("g1", "u1", "quiz", "msg-1", { correct: false });

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const events = await prisma.xpEvent.findMany({ where: { userId: "u1" } });
    expect(events).toHaveLength(1);
  });

  it("signale un passage de niveau", async () => {
    let last: Awaited<ReturnType<typeof LevelService.award>> = null;
    for (let i = 0; i < 4; i++) {
      last = await LevelService.award("g1", "u1", "quiz", `msg-${i}`, { correct: true });
    }
    expect(last!.xp).toBe(100);
    expect(last!.level).toBe(1);
    expect(last!.leveledUp).toBe(true);
  });
});

describe("LevelService leaderboards", () => {
  it("classe par XP décroissante et respecte la limite", async () => {
    await LevelService.award("g1", "low", "quiz", "m1", { correct: false });
    await LevelService.award("g1", "high", "quiz", "m2", { correct: true });

    const board = await LevelService.xpLeaderboard("g1", 10);
    expect(board.map((e) => e.userId)).toEqual(["high", "low"]);
  });

  it("quizLeaderboard ne garde que les joueurs ayant au moins une bonne réponse", async () => {
    await LevelService.award("g1", "correct", "quiz", "m1", { correct: true });
    await LevelService.award("g1", "wrong", "quiz", "m2", { correct: false });

    const board = await LevelService.quizLeaderboard("g1", 10);
    expect(board.map((e) => e.userId)).toEqual(["correct"]);
  });
});
