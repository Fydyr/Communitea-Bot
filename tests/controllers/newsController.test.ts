import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockInteraction } from "../helpers/mockInteraction";

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/services/GuildSettingsService", () => ({
  DEFAULT_LANGUAGE: "fr",
  GuildSettingsService: {
    getLanguage: vi.fn().mockResolvedValue("fr"),
    addNewsHour: vi.fn(),
    removeNewsHour: vi.fn(),
  },
}));

vi.mock("../../src/services/NewsService", () => ({
  NewsService: { sendDigestToGuild: vi.fn() },
}));

const { newsChannel } = vi.hoisted(() => ({
  newsChannel: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("../../src/lib/prisma", () => ({ prisma: { newsChannel } }));

import { NewsController } from "../../src/controllers/NewsController";
import { GuildSettingsService } from "../../src/services/GuildSettingsService";
import { NewsService } from "../../src/services/NewsService";

const addNewsHour = GuildSettingsService.addNewsHour as unknown as ReturnType<typeof vi.fn>;
const removeNewsHour = GuildSettingsService.removeNewsHour as unknown as ReturnType<typeof vi.fn>;
const sendDigestToGuild = NewsService.sendDigestToGuild as unknown as ReturnType<typeof vi.fn>;

const channel = { id: "c1", name: "actu" } as any;

describe("NewsController", () => {
  let controller: NewsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NewsController();
  });

  it("setup : crée la configuration quand le salon est nouveau", async () => {
    newsChannel.findUnique.mockResolvedValue(null);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.setupNews(channel, null, interaction);

    expect(newsChannel.create).toHaveBeenCalledWith({
      data: { guildId: "g1", channelId: "c1", roleId: null },
    });
    expect(String(editReply.mock.calls[0][0])).toContain("<#c1>");
  });

  it("setup : met à jour le rôle quand le salon existe déjà", async () => {
    newsChannel.findUnique.mockResolvedValue({ id: "row-1" });
    const { interaction } = createMockInteraction({ guildId: "g1" });

    await controller.setupNews(channel, { id: "r1" } as any, interaction);

    expect(newsChannel.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { roleId: "r1" },
    });
    expect(newsChannel.create).not.toHaveBeenCalled();
  });

  it("setup : refuse hors serveur", async () => {
    const { interaction, editReply } = createMockInteraction({ guildId: null });

    await controller.setupNews(channel, null, interaction);

    expect(newsChannel.create).not.toHaveBeenCalled();
    expect(String(editReply.mock.calls[0][0])).toContain("serveur");
  });

  it("remove : signale un salon non configuré", async () => {
    newsChannel.deleteMany.mockResolvedValue({ count: 0 });
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.removeNews(channel, interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("n'était pas configuré");
  });

  it("list : annonce l'absence de configuration", async () => {
    newsChannel.findMany.mockResolvedValue([]);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.listNews(interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("/news-setup");
  });

  it("hour-add : refuse une heure invalide", async () => {
    addNewsHour.mockResolvedValue({ status: "invalid" });
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.addNewsHour(24, interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("entier entre 0 et 23");
  });

  it("hour-add : confirme l'ajout avec la liste à jour", async () => {
    addNewsHour.mockResolvedValue({ status: "added", hours: [8, 19] });
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.addNewsHour(8, interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("8h, 19h");
  });

  it("hour-remove : signale la liste vidée", async () => {
    removeNewsHour.mockResolvedValue({ status: "removed", hours: [], emptied: true });
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.removeNewsHour(8, interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("Plus aucune news");
  });

  it("news : liste les salons servis", async () => {
    newsChannel.count.mockResolvedValue(2);
    sendDigestToGuild.mockResolvedValue(["c1", "c2"]);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.sendNews(interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("<#c1>");
    expect(String(editReply.mock.calls[0][0])).toContain("<#c2>");
  });

  it("news : signale l'échec du sourcing", async () => {
    newsChannel.count.mockResolvedValue(1);
    sendDigestToGuild.mockResolvedValue([]);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.sendNews(interaction);

    expect(String(editReply.mock.calls[0][0])).toContain("Impossible de récupérer les news");
  });

  it("news : invite à configurer un salon quand aucun n'existe", async () => {
    newsChannel.count.mockResolvedValue(0);
    const { interaction, editReply } = createMockInteraction({ guildId: "g1" });

    await controller.sendNews(interaction);

    // Message distinct de l'échec de sourcing : ici, attendre ne sert à rien.
    const reply = String(editReply.mock.calls[0][0]);
    expect(reply).toContain("/news-setup");
    expect(reply).not.toContain("Impossible de récupérer les news");
    // Aucun sourcing n'est lancé pour rien.
    expect(sendDigestToGuild).not.toHaveBeenCalled();
  });
});
