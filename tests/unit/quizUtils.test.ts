import { describe, it, expect } from "vitest";
import { shuffleQuizOptions } from "../../src/services/quizUtils";

describe("shuffleQuizOptions", () => {
  it("garde le texte de la bonne réponse à correctIndex", () => {
    const original = ["A", "B", "C", "D"];
    const result = shuffleQuizOptions(original, 0);
    expect(result.options[result.correctIndex]).toBe("A");
  });

  it("préserve toutes les options d'origine", () => {
    const result = shuffleQuizOptions(["A", "B", "C", "D"], 2);
    expect([...result.options].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("distribue la bonne réponse sur plusieurs positions", () => {
    const positions = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const result = shuffleQuizOptions(["A", "B", "C", "D"], 0);
      positions.add(result.correctIndex);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});
