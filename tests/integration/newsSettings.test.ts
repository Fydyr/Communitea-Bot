import { describe, it, expect } from "vitest";
import { GuildSettingsService } from "../../src/services/GuildSettingsService";

describe("GuildSettingsService — heures de news", () => {
  it("part d'une liste vide sur un serveur sans configuration", async () => {
    const settings = await GuildSettingsService.get("g-news-1");
    expect(settings.newsHours).toEqual([]);
    expect(settings.isDefault).toBe(true);
  });

  it("ajoute une heure et la renvoie triée", async () => {
    await GuildSettingsService.addNewsHour("g-news-2", 19);
    const result = await GuildSettingsService.addNewsHour("g-news-2", 8);

    expect(result.status).toBe("added");
    expect(result.status === "added" && result.hours).toEqual([8, 19]);
  });

  it("refuse une heure hors de 0-23", async () => {
    const result = await GuildSettingsService.addNewsHour("g-news-3", 24);
    expect(result.status).toBe("invalid");
  });

  it("signale un doublon sans le rajouter", async () => {
    await GuildSettingsService.addNewsHour("g-news-4", 8);
    const result = await GuildSettingsService.addNewsHour("g-news-4", 8);

    expect(result.status).toBe("exists");
    expect(result.status === "exists" && result.hours).toEqual([8]);
  });

  it("retire une heure et signale la liste vidée", async () => {
    await GuildSettingsService.addNewsHour("g-news-5", 8);
    const result = await GuildSettingsService.removeNewsHour("g-news-5", 8);

    expect(result.status).toBe("removed");
    expect(result.status === "removed" && result.emptied).toBe(true);
  });

  it("n'affecte pas les heures d'anecdotes ni de quiz", async () => {
    await GuildSettingsService.addHour("g-news-6", 8);
    await GuildSettingsService.addQuizHour("g-news-6", 12);
    await GuildSettingsService.addNewsHour("g-news-6", 19);

    const settings = await GuildSettingsService.get("g-news-6");
    expect(settings.hours).toEqual([8]);
    expect(settings.quizHours).toEqual([12]);
    expect(settings.newsHours).toEqual([19]);
  });
});
