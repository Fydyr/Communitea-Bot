import { describe, it, expect } from "vitest";
import { LevelService } from "../../src/services/LevelService";

describe("LevelService.xpForLevel", () => {
  it("vaut 0 pour le niveau 0", () => {
    expect(LevelService.xpForLevel(0)).toBe(0);
  });

  it("suit 100 * niveau²", () => {
    expect(LevelService.xpForLevel(1)).toBe(100);
    expect(LevelService.xpForLevel(3)).toBe(900);
  });
});

describe("LevelService.levelForXp", () => {
  it("vaut 0 pour 0 XP", () => {
    expect(LevelService.levelForXp(0)).toBe(0);
  });

  it("ramène une XP négative au niveau 0", () => {
    expect(LevelService.levelForXp(-50)).toBe(0);
  });

  it("atteint le niveau au seuil exact", () => {
    expect(LevelService.levelForXp(100)).toBe(1);
    expect(LevelService.levelForXp(900)).toBe(3);
  });

  it("reste au niveau inférieur juste sous le seuil", () => {
    expect(LevelService.levelForXp(99)).toBe(0);
    expect(LevelService.levelForXp(899)).toBe(2);
  });

  it("est réciproque de xpForLevel aux seuils", () => {
    for (let level = 0; level <= 5; level++) {
      expect(LevelService.levelForXp(LevelService.xpForLevel(level))).toBe(level);
    }
  });
});
