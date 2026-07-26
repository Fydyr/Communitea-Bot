import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";

// Prompts capturés par le SDK Gemini mocké : permet de vérifier que les
// questions déjà envoyées sont bien injectées dans le prompt d'exclusion.
const capturedPrompts: string[] = [];

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async (prompt: string) => {
          capturedPrompts.push(prompt);
          return {
            response: {
              text: () =>
                JSON.stringify({
                  question: "Question générée par le mock",
                  options: ["Alpha", "Bravo", "Charlie", "Delta"],
                  correctIndex: 0,
                  explanation: "Explication.",
                }),
            },
          };
        },
      };
    }
  },
}));

// Force une clé API pour que GeminiService initialise son client (mocké).
vi.mock("../../src/config", () => ({
  config: { geminiApiKey: "test-key" },
}));

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

import { QuizService } from "../../src/services/QuizService";

describe("QuizService.generateForGuild — mémoire anti-répétition", () => {
  beforeEach(() => {
    capturedPrompts.length = 0;
  });

  it("transmet les questions déjà envoyées à Gemini comme exclusions", async () => {
    await prisma.sentQuiz.create({
      data: { guildId: "g-mem", question: "En quelle année est né ARPANET ?" },
    });

    const result = await QuizService.generateForGuild("g-mem");

    expect(result).not.toBeNull();
    expect(capturedPrompts).toHaveLength(1);
    expect(capturedPrompts[0]).toContain("En quelle année est né ARPANET ?");
    expect(capturedPrompts[0]).toContain("INTERDITES");
  });

  it("n'ajoute pas de bloc d'exclusion quand aucune question n'a été envoyée", async () => {
    const result = await QuizService.generateForGuild("g-empty");

    expect(result).not.toBeNull();
    expect(capturedPrompts).toHaveLength(1);
    expect(capturedPrompts[0]).not.toContain("INTERDITES");
  });
});
