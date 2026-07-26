import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockInteraction } from "../helpers/mockInteraction";

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("../../src/services/LevelService", () => ({
  LevelService: { xpLeaderboard: vi.fn() },
}));
vi.mock("../../src/services/GuildSettingsService", () => ({
  DEFAULT_LANGUAGE: "fr",
  GuildSettingsService: { getLanguage: vi.fn().mockResolvedValue("fr") },
}));

import { AnecdoteController } from "../../src/controllers/AnecdoteController";
import { LevelService } from "../../src/services/LevelService";

describe("AnecdoteController.leaderboard", () => {
  let controller: AnecdoteController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AnecdoteController();
  });

  it("répond avec un embed classant les joueurs", async () => {
    (LevelService.xpLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "u1", xp: 250, level: 1, quizAnswered: 10, quizCorrect: 8 },
    ]);
    const { interaction, deferReply, editReply } = createMockInteraction();

    await controller.leaderboard(interaction);

    expect(deferReply).toHaveBeenCalledOnce();
    const arg = editReply.mock.calls[0][0];
    expect(arg.embeds).toBeDefined();
    expect(arg.embeds[0].data.description).toContain("<@u1>");
  });

  it("affiche un message vide quand personne n'a d'XP", async () => {
    (LevelService.xpLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { interaction, editReply } = createMockInteraction();

    await controller.leaderboard(interaction);

    expect(editReply).toHaveBeenCalledWith("Personne n'a encore gagné d'XP sur ce serveur.");
  });

  it("refuse hors serveur (guildId null)", async () => {
    const { interaction, editReply } = createMockInteraction({ guildId: null });

    await controller.leaderboard(interaction);

    expect(LevelService.xpLeaderboard).not.toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();
  });
});
