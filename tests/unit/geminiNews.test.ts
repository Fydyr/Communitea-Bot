import { describe, it, expect, vi, beforeEach } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent };
    }
  },
}));

vi.mock("../../src/config", () => ({
  config: { geminiApiKey: "test-key" },
}));

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("axios", () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

import axios from "axios";
import { GeminiService } from "../../src/services/GeminiService";

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

function sdkReply(payload: unknown) {
  return { response: { text: () => JSON.stringify(payload) } };
}

function restReply(text: string) {
  return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
}

const ARTICLES = [
  { title: "Un titre", description: "Une description.", source: "a.test" },
  { title: "Un autre", description: "Autre description.", source: "b.test" },
];

describe("GeminiService.summarizeNewsItems", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie un résumé par article, dans l'ordre", async () => {
    generateContent.mockResolvedValue(sdkReply({ summaries: ["Résumé 1.", "Résumé 2."] }));

    const result = await GeminiService.summarizeNewsItems(ARTICLES, "fr");

    expect(result).toEqual(["Résumé 1.", "Résumé 2."]);
  });

  it("renvoie null si le nombre de résumés ne correspond pas", async () => {
    generateContent.mockResolvedValue(sdkReply({ summaries: ["Un seul."] }));

    expect(await GeminiService.summarizeNewsItems(ARTICLES, "fr")).toBeNull();
  });

  it("renvoie null quand tous les modèles échouent", async () => {
    generateContent.mockRejectedValue(new Error("503 overloaded"));

    expect(await GeminiService.summarizeNewsItems(ARTICLES, "fr")).toBeNull();
  });

  it("transmet la langue du serveur dans le prompt", async () => {
    generateContent.mockResolvedValue(sdkReply({ summaries: ["a", "b"] }));

    await GeminiService.summarizeNewsItems(ARTICLES, "de");

    expect(String(generateContent.mock.calls[0][0])).toContain("allemand");
  });
});

describe("GeminiService.searchNews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("active l'outil de recherche Google dans la requête REST", async () => {
    post.mockResolvedValue(
      restReply(
        JSON.stringify({
          items: [
            { title: "T1", url: "https://n.test/1", summary: "S1", source: "N" },
            { title: "T2", url: "https://n.test/2", summary: "S2", source: "N" },
            { title: "T3", url: "https://n.test/3", summary: "S3", source: "N" },
          ],
        })
      )
    );

    const result = await GeminiService.searchNews("", "fr");

    expect(result).toHaveLength(3);
    expect(post.mock.calls[0][1]).toMatchObject({ tools: [{ google_search: {} }] });
  });

  it("extrait le JSON noyé dans du texte, le grounding interdisant le mode JSON strict", async () => {
    post.mockResolvedValue(
      restReply(
        'Voici les actualités :\n```json\n{"items":[' +
          '{"title":"T1","url":"https://n.test/1","summary":"S1","source":"N"},' +
          '{"title":"T2","url":"https://n.test/2","summary":"S2","source":"N"},' +
          '{"title":"T3","url":"https://n.test/3","summary":"S3","source":"N"}' +
          "]}\n```\nBonne lecture."
      )
    );

    expect(await GeminiService.searchNews("", "fr")).toHaveLength(3);
  });

  it("écarte les entrées sans URL http(s)", async () => {
    post.mockResolvedValue(
      restReply(
        JSON.stringify({
          items: [
            { title: "T1", url: "javascript:alert(1)", summary: "S1", source: "N" },
            { title: "T2", url: "https://n.test/2", summary: "S2", source: "N" },
            { title: "T3", url: "https://n.test/3", summary: "S3", source: "N" },
            { title: "T4", url: "https://n.test/4", summary: "S4", source: "N" },
          ],
        })
      )
    );

    const result = await GeminiService.searchNews("", "fr");
    expect(result?.map((i) => i.url)).toEqual([
      "https://n.test/2",
      "https://n.test/3",
      "https://n.test/4",
    ]);
  });

  it("renvoie null en dessous de 3 articles exploitables", async () => {
    post.mockResolvedValue(
      restReply(JSON.stringify({ items: [{ title: "T1", url: "https://n.test/1", summary: "S1", source: "N" }] }))
    );

    expect(await GeminiService.searchNews("", "fr")).toBeNull();
  });

  it("renvoie null quand tous les modèles renvoient une erreur", async () => {
    post.mockRejectedValue(new Error("429 quota"));

    expect(await GeminiService.searchNews("", "fr")).toBeNull();
  });
});

describe("GeminiService.generateNewsDigest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie les articles générés", async () => {
    generateContent.mockResolvedValue(
      sdkReply({
        items: [
          { title: "T1", url: "https://g.test/1", summary: "S1", source: "G" },
          { title: "T2", url: "https://g.test/2", summary: "S2", source: "G" },
          { title: "T3", url: "https://g.test/3", summary: "S3", source: "G" },
        ],
      })
    );

    expect(await GeminiService.generateNewsDigest("", "fr")).toHaveLength(3);
  });

  it("renvoie null quand la structure est inexploitable", async () => {
    generateContent.mockResolvedValue(sdkReply({ items: "pas un tableau" }));

    expect(await GeminiService.generateNewsDigest("", "fr")).toBeNull();
  });
});
