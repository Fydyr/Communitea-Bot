import { describe, it, expect } from "vitest";
import { feedsForThemes, NEWS_FEEDS_BY_THEME, DEFAULT_NEWS_FEEDS } from "../../src/services/newsFeeds";
import { SUPPORTED_THEMES } from "../../src/services/GuildSettingsService";

describe("feedsForThemes", () => {
  it("renvoie les flux généralistes quand aucun thème n'est configuré", () => {
    expect(feedsForThemes([])).toEqual(DEFAULT_NEWS_FEEDS);
  });

  it("renvoie les flux du thème demandé", () => {
    expect(feedsForThemes(["securite"])).toEqual(NEWS_FEEDS_BY_THEME.securite);
  });

  it("fusionne les flux de plusieurs thèmes sans doublon", () => {
    const result = feedsForThemes(["securite", "ia"]);
    expect(new Set(result).size).toBe(result.length);
    expect(result).toEqual(expect.arrayContaining(NEWS_FEEDS_BY_THEME.ia));
  });

  it("renvoie une liste vide pour le seul thème histoire, qui n'a pas de flux d'actualité", () => {
    expect(feedsForThemes(["histoire"])).toEqual([]);
  });

  it("ignore histoire quand il accompagne un thème pourvu de flux", () => {
    expect(feedsForThemes(["histoire", "ia"])).toEqual(NEWS_FEEDS_BY_THEME.ia);
  });

  it("couvre tous les thèmes supportés", () => {
    for (const theme of SUPPORTED_THEMES) {
      expect(NEWS_FEEDS_BY_THEME[theme]).toBeDefined();
    }
  });

  it("ne déclare que des URLs http(s)", () => {
    const all = [...DEFAULT_NEWS_FEEDS, ...Object.values(NEWS_FEEDS_BY_THEME).flat()];
    for (const url of all) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});
