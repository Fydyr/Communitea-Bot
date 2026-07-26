import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockInteraction } from "../helpers/mockInteraction";

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("../../src/services/GuildSettingsService", () => ({
  DEFAULT_LANGUAGE: "fr",
  GuildSettingsService: { getLanguage: vi.fn().mockResolvedValue("fr") },
}));
vi.mock("../../src/services/QuizService", () => ({
  QuizService: {
    generateForGuild: vi.fn(),
    generate: vi.fn(),
    buildMessage: vi.fn(() => ({ embeds: ["embed"], components: ["row"] })),
    attachCollector: vi.fn(),
    saveSentQuiz: vi.fn().mockResolvedValue(undefined),
  },
}));

import { AnecdoteController } from "../../src/controllers/AnecdoteController";
import { QuizService } from "../../src/services/QuizService";

const FAKE_QUIZ = {
  quiz: { question: "Q?", options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "e" },
  lang: "fr" as const,
};

describe("AnecdoteController.quiz", () => {
  let controller: AnecdoteController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AnecdoteController();
  });

  it("envoie le quiz et mémorise la question en serveur", async () => {
    (QuizService.generateForGuild as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_QUIZ);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.quiz(interaction);

    expect(QuizService.generateForGuild).toHaveBeenCalledWith("g1");
    expect(editReply).toHaveBeenCalledWith({ embeds: ["embed"], components: ["row"] });
    expect(QuizService.attachCollector).toHaveBeenCalled();
    expect(QuizService.saveSentQuiz).toHaveBeenCalledWith("g1", "Q?");
  });

  it("répond avec un message d'échec si la génération échoue", async () => {
    (QuizService.generateForGuild as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.quiz(interaction);

    expect(editReply).toHaveBeenCalledOnce();
    expect(QuizService.attachCollector).not.toHaveBeenCalled();
    expect(QuizService.saveSentQuiz).not.toHaveBeenCalled();
  });

  it("hors serveur : génère sans mémoriser", async () => {
    (QuizService.generate as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_QUIZ);
    const { interaction } = createMockInteraction({ guildId: null });

    await controller.quiz(interaction);

    expect(QuizService.generate).toHaveBeenCalled();
    expect(QuizService.generateForGuild).not.toHaveBeenCalled();
    expect(QuizService.saveSentQuiz).not.toHaveBeenCalled();
  });
});
