import { describe, it, expect, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { QuizService } from "../../src/services/QuizService";

// Le LoggerService écrit vers un webhook Discord : on le neutralise.
vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: {
    info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(),
  },
}));

describe("QuizService.saveSentQuiz", () => {
  it("persiste la question du quiz pour le serveur", async () => {
    await QuizService.saveSentQuiz("guild-1", "  Quelle est la capacité d'un octet ?  ");

    const rows = await prisma.sentQuiz.findMany({ where: { guildId: "guild-1" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe("Quelle est la capacité d'un octet ?");
  });

  it("isole les questions par serveur", async () => {
    await QuizService.saveSentQuiz("guild-1", "Q1");
    await QuizService.saveSentQuiz("guild-2", "Q2");

    const g1 = await prisma.sentQuiz.findMany({ where: { guildId: "guild-1" } });
    expect(g1).toHaveLength(1);
    expect(g1[0].question).toBe("Q1");
  });
});
