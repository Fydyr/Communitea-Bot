import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/services/GeminiService", () => ({
  GeminiService: {
    summarizeNewsItems: vi.fn(),
    searchNews: vi.fn(),
    generateNewsDigest: vi.fn(),
  },
}));

// AnecdoteService importe `bot` depuis src/index, qui instancie un client
// Discord au chargement du module. On le remplace : seule buildThemesContext
// est utilisée ici, et elle est purement textuelle.
vi.mock("../../src/services/AnecdoteService", () => ({
  AnecdoteService: { buildThemesContext: (themes: string[]) => (themes.length ? ` THEMES: ${themes.join(",")}` : "") },
}));

import axios from "axios";
import { NewsSourceService } from "../../src/services/NewsSourceService";
import { GeminiService } from "../../src/services/GeminiService";

const get = axios.get as unknown as ReturnType<typeof vi.fn>;
const summarize = GeminiService.summarizeNewsItems as unknown as ReturnType<typeof vi.fn>;
const searchNews = GeminiService.searchNews as unknown as ReturnType<typeof vi.fn>;
const generateDigest = GeminiService.generateNewsDigest as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-08-04T12:00:00Z");

/** Flux RSS de test avec `count` articles frais. */
function feedXml(count: number, prefix: string): string {
  const items = Array.from({ length: count }, (_unused, index) => `
    <item>
      <title>${prefix} article ${index}</title>
      <link>https://${prefix}.test/${index}</link>
      <description>Description ${index}.</description>
      <pubDate>Tue, 04 Aug 2026 08:00:00 GMT</pubDate>
    </item>`).join("");

  return `<rss version="2.0"><channel>${items}</channel></rss>`;
}

describe("NewsSourceService.buildDigest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("niveau 1 : construit le digest depuis le RSS avec les résumés Gemini", async () => {
    get.mockResolvedValue({ data: feedXml(4, "rss") });
    summarize.mockResolvedValue(["R0.", "R1.", "R2.", "R3."]);

    const digest = await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW);

    expect(digest?.tier).toBe("rss");
    expect(digest?.degraded).toBe(false);
    expect(digest?.items).toHaveLength(4);
    expect(digest?.items[0].summary).toBe("R0.");
    expect(searchNews).not.toHaveBeenCalled();
  });

  it("mode dégradé : publie les titres bruts si les résumés échouent", async () => {
    get.mockResolvedValue({ data: feedXml(4, "rss") });
    summarize.mockResolvedValue(null);

    const digest = await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW);

    expect(digest?.tier).toBe("rss");
    expect(digest?.degraded).toBe(true);
    expect(digest?.items).toHaveLength(4);
    expect(searchNews).not.toHaveBeenCalled();
  });

  it("exclut les URLs déjà publiées avant de compter les articles", async () => {
    get.mockResolvedValue({ data: feedXml(4, "rss") });
    summarize.mockResolvedValue(["R.", "R.", "R."]);

    const digest = await NewsSourceService.buildDigest(
      "fr",
      ["ia"],
      new Set(["https://rss.test/0"]),
      NOW
    );

    expect(digest?.items.map((i) => i.url)).not.toContain("https://rss.test/0");
    expect(digest?.items).toHaveLength(3);
  });

  it("passe au niveau 2 quand le RSS rend moins de 3 articles", async () => {
    get.mockResolvedValue({ data: feedXml(2, "rss") });
    searchNews.mockResolvedValue([
      { title: "S1", url: "https://s.test/1", summary: "s1", source: "S" },
      { title: "S2", url: "https://s.test/2", summary: "s2", source: "S" },
      { title: "S3", url: "https://s.test/3", summary: "s3", source: "S" },
    ]);

    const digest = await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW);

    expect(digest?.tier).toBe("search");
    expect(digest?.degraded).toBe(false);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("passe au niveau 2 quand tous les flux sont injoignables", async () => {
    get.mockRejectedValue(new Error("ENOTFOUND"));
    searchNews.mockResolvedValue([
      { title: "S1", url: "https://s.test/1", summary: "s1", source: "S" },
      { title: "S2", url: "https://s.test/2", summary: "s2", source: "S" },
      { title: "S3", url: "https://s.test/3", summary: "s3", source: "S" },
    ]);

    const digest = await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW);
    expect(digest?.tier).toBe("search");
  });

  it("saute le niveau 1 quand le serveur n'a que le thème histoire", async () => {
    searchNews.mockResolvedValue([
      { title: "S1", url: "https://s.test/1", summary: "s1", source: "S" },
      { title: "S2", url: "https://s.test/2", summary: "s2", source: "S" },
      { title: "S3", url: "https://s.test/3", summary: "s3", source: "S" },
    ]);

    const digest = await NewsSourceService.buildDigest("fr", ["histoire"], new Set(), NOW);

    expect(get).not.toHaveBeenCalled();
    expect(digest?.tier).toBe("search");
  });

  it("filtre au niveau 2 les URLs déjà publiées", async () => {
    get.mockResolvedValue({ data: feedXml(0, "rss") });
    searchNews.mockResolvedValue([
      { title: "S1", url: "https://s.test/1", summary: "s1", source: "S" },
      { title: "S2", url: "https://s.test/2", summary: "s2", source: "S" },
      { title: "S3", url: "https://s.test/3", summary: "s3", source: "S" },
    ]);
    generateDigest.mockResolvedValue([
      { title: "G1", url: "https://g.test/1", summary: "g1", source: "G" },
      { title: "G2", url: "https://g.test/2", summary: "g2", source: "G" },
      { title: "G3", url: "https://g.test/3", summary: "g3", source: "G" },
    ]);

    const digest = await NewsSourceService.buildDigest(
      "fr",
      ["ia"],
      new Set(["https://s.test/1"]),
      NOW
    );

    // Deux articles restants au niveau 2, donc insuffisant : on descend au niveau 3.
    expect(digest?.tier).toBe("generated");
  });

  it("niveau 3 en dernier recours", async () => {
    get.mockResolvedValue({ data: feedXml(0, "rss") });
    searchNews.mockResolvedValue(null);
    generateDigest.mockResolvedValue([
      { title: "G1", url: "https://g.test/1", summary: "g1", source: "G" },
      { title: "G2", url: "https://g.test/2", summary: "g2", source: "G" },
      { title: "G3", url: "https://g.test/3", summary: "g3", source: "G" },
    ]);

    const digest = await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW);
    expect(digest?.tier).toBe("generated");
  });

  it("renvoie null quand les trois niveaux échouent", async () => {
    get.mockRejectedValue(new Error("ENOTFOUND"));
    searchNews.mockResolvedValue(null);
    generateDigest.mockResolvedValue(null);

    expect(await NewsSourceService.buildDigest("fr", ["ia"], new Set(), NOW)).toBeNull();
  });

  it("continue avec les flux valides quand un seul flux échoue", async () => {
    get.mockImplementation((url: string) =>
      url.includes("krebs")
        ? Promise.reject(new Error("500"))
        : Promise.resolve({ data: feedXml(4, "rss") })
    );
    summarize.mockResolvedValue(["R.", "R.", "R.", "R."]);

    const digest = await NewsSourceService.buildDigest("fr", ["securite"], new Set(), NOW);
    expect(digest?.tier).toBe("rss");
  });
});
