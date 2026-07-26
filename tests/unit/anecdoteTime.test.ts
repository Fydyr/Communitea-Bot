import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnecdoteService } from "../../src/services/AnecdoteService";

describe("AnecdoteService helpers de temps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renvoie l'heure locale dans le fuseau demandé", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
    expect(AnecdoteService.getCurrentHourInTimezone("Europe/Paris")).toBe(14);
    expect(AnecdoteService.getCurrentHourInTimezone("America/New_York")).toBe(8);
  });

  it("ramène minuit à 0", () => {
    vi.setSystemTime(new Date("2026-07-26T22:00:00Z"));
    expect(AnecdoteService.getCurrentHourInTimezone("Europe/Paris")).toBe(0);
  });

  it("renvoie le bon jour de la semaine (0 = dimanche)", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
    expect(AnecdoteService.getCurrentWeekdayInTimezone("Europe/Paris")).toBe(0);
  });
});
