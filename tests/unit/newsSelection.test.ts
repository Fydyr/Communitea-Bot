import { describe, it, expect } from "vitest";
import { selectItems } from "../../src/services/newsSelection";
import type { RawFeedItem } from "../../src/services/newsTypes";

const NOW = new Date("2026-08-04T12:00:00Z");

function item(overrides: Partial<RawFeedItem> & { url: string }): RawFeedItem {
  return {
    title: `Titre ${overrides.url}`,
    description: "Description.",
    publishedAt: new Date("2026-08-04T08:00:00Z"),
    source: "a.test",
    ...overrides,
  };
}

describe("selectItems", () => {
  it("garde les articles de moins de 24 h", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: new Date("2026-08-04T06:00:00Z") }),
      item({ url: "https://a.test/2", publishedAt: new Date("2026-08-03T20:00:00Z") }),
      item({ url: "https://a.test/3", publishedAt: new Date("2026-08-04T11:00:00Z") }),
    ];

    expect(selectItems(items, new Set(), NOW)).toHaveLength(3);
  });

  it("élargit à 48 h quand moins de 3 articles tiennent dans les 24 h", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: new Date("2026-08-04T06:00:00Z") }),
      item({ url: "https://a.test/2", publishedAt: new Date("2026-08-03T02:00:00Z") }),
      item({ url: "https://a.test/3", publishedAt: new Date("2026-08-02T20:00:00Z") }),
    ];

    const result = selectItems(items, new Set(), NOW);
    expect(result).toHaveLength(3);
  });

  it("écarte les articles plus vieux que 48 h même en manque de candidats", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: new Date("2026-08-04T06:00:00Z") }),
      item({ url: "https://a.test/2", publishedAt: new Date("2026-07-20T06:00:00Z") }),
    ];

    const result = selectItems(items, new Set(), NOW);
    expect(result.map((i) => i.url)).toEqual(["https://a.test/1"]);
  });

  it("écarte les articles sans date", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: null }),
      item({ url: "https://a.test/2" }),
    ];

    expect(selectItems(items, new Set(), NOW).map((i) => i.url)).toEqual(["https://a.test/2"]);
  });

  it("exclut les URLs déjà publiées", () => {
    const items = [
      item({ url: "https://a.test/1" }),
      item({ url: "https://a.test/2" }),
    ];

    const result = selectItems(items, new Set(["https://a.test/1"]), NOW);
    expect(result.map((i) => i.url)).toEqual(["https://a.test/2"]);
  });

  it("dédoublonne les URLs identiques venues de deux flux", () => {
    const items = [
      item({ url: "https://a.test/1", source: "a.test" }),
      item({ url: "https://a.test/1", source: "b.test" }),
    ];

    expect(selectItems(items, new Set(), NOW)).toHaveLength(1);
  });

  it("alterne les sources plutôt que de vider le premier flux", () => {
    const items = [
      item({ url: "https://a.test/1", source: "a.test" }),
      item({ url: "https://a.test/2", source: "a.test" }),
      item({ url: "https://a.test/3", source: "a.test" }),
      item({ url: "https://b.test/1", source: "b.test" }),
      item({ url: "https://b.test/2", source: "b.test" }),
    ];

    const result = selectItems(items, new Set(), NOW);
    expect(result.map((i) => i.source)).toEqual(["a.test", "b.test", "a.test", "b.test", "a.test"]);
  });

  it("ne dépasse jamais 5 articles", () => {
    const items = Array.from({ length: 12 }, (_unused, index) =>
      item({ url: `https://a.test/${index}` })
    );

    expect(selectItems(items, new Set(), NOW)).toHaveLength(5);
  });

  it("trie les articles d'une même source du plus récent au plus ancien", () => {
    const items = [
      item({ url: "https://a.test/vieux", publishedAt: new Date("2026-08-04T01:00:00Z") }),
      item({ url: "https://a.test/recent", publishedAt: new Date("2026-08-04T11:00:00Z") }),
    ];

    expect(selectItems(items, new Set(), NOW)[0].url).toBe("https://a.test/recent");
  });

  it("renvoie une liste vide quand rien ne convient", () => {
    expect(selectItems([], new Set(), NOW)).toEqual([]);
  });

  it("élargit à 48 h tout en excluant les URLs déjà publiées", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: new Date("2026-08-04T06:00:00Z") }),
      item({ url: "https://a.test/2", publishedAt: new Date("2026-08-04T10:00:00Z") }),
      item({ url: "https://a.test/3", publishedAt: new Date("2026-08-04T11:00:00Z") }),
      item({ url: "https://a.test/old1", publishedAt: new Date("2026-08-03T06:00:00Z") }),
      item({ url: "https://a.test/old2", publishedAt: new Date("2026-08-02T20:00:00Z") }),
    ];

    const sentUrls = new Set(["https://a.test/1", "https://a.test/2"]);
    const result = selectItems(items, sentUrls, NOW);

    // Vérifie que les URLs exclues ne réapparaissent pas
    expect(result.map((i) => i.url)).not.toContain("https://a.test/1");
    expect(result.map((i) => i.url)).not.toContain("https://a.test/2");

    // Vérifie que l'élargissement a eu lieu : au moins un article du band 24-48h
    const urls = result.map((i) => i.url);
    expect(urls).toContain("https://a.test/old1");
  });

  it("l'exclusion seule peut déclencher l'élargissement", () => {
    const items = [
      item({ url: "https://a.test/1", publishedAt: new Date("2026-08-04T11:00:00Z") }),
      item({ url: "https://a.test/2", publishedAt: new Date("2026-08-04T10:00:00Z") }),
      item({ url: "https://a.test/3", publishedAt: new Date("2026-08-04T09:00:00Z") }),
      item({ url: "https://a.test/4", publishedAt: new Date("2026-08-04T08:00:00Z") }),
      item({ url: "https://a.test/5", publishedAt: new Date("2026-08-04T07:00:00Z") }),
      item({ url: "https://a.test/old1", publishedAt: new Date("2026-08-03T06:00:00Z") }),
      item({ url: "https://a.test/old2", publishedAt: new Date("2026-08-02T20:00:00Z") }),
    ];

    const sentUrls = new Set([
      "https://a.test/2",
      "https://a.test/3",
      "https://a.test/4",
    ]);
    const result = selectItems(items, sentUrls, NOW);

    // Après exclusion, seuls 2 articles du band 24h restent (< MIN_ITEMS)
    // L'élargissement doit déclencher, incluant des articles du band 24-48h
    const urls = result.map((i) => i.url);
    expect(urls).toContain("https://a.test/old1");
  });
});
