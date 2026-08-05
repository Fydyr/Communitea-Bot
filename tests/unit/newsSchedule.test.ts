import { describe, it, expect } from "vitest";
import {
  localDateInTimezone,
  localHourInTimezone,
  isDue,
  nextRunState,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
} from "../../src/services/newsSchedule";

describe("localDateInTimezone", () => {
  it("renvoie la date au format YYYY-MM-DD", () => {
    expect(localDateInTimezone("Europe/Paris", new Date("2026-08-04T12:00:00Z"))).toBe("2026-08-04");
  });

  it("donne le lendemain à Tokyo quand il est encore la veille à Paris", () => {
    const instant = new Date("2026-08-04T22:00:00Z");
    expect(localDateInTimezone("Europe/Paris", instant)).toBe("2026-08-05");
    expect(localDateInTimezone("Asia/Tokyo", instant)).toBe("2026-08-05");
    expect(localDateInTimezone("America/New_York", instant)).toBe("2026-08-04");
  });

  it("gère le passage de minuit dans le fuseau du serveur", () => {
    const instant = new Date("2026-08-04T23:30:00Z");
    expect(localDateInTimezone("Europe/Paris", instant)).toBe("2026-08-05");
    expect(localDateInTimezone("UTC", instant)).toBe("2026-08-04");
  });

  it("produit toujours le format YYYY-MM-DD, quelle que soit la locale du runtime", () => {
    expect(localDateInTimezone("Europe/Paris", new Date("2026-01-09T12:00:00Z"))).toBe("2026-01-09");
    expect(localDateInTimezone("UTC", new Date("2026-12-31T23:59:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("localHourInTimezone", () => {
  it("renvoie l'heure locale du fuseau", () => {
    const instant = new Date("2026-08-04T06:00:00Z");
    expect(localHourInTimezone("UTC", instant)).toBe(6);
    expect(localHourInTimezone("Europe/Paris", instant)).toBe(8);
    expect(localHourInTimezone("Asia/Tokyo", instant)).toBe(15);
  });

  it("ramène minuit à 0 et non à 24", () => {
    expect(localHourInTimezone("UTC", new Date("2026-08-04T00:15:00Z"))).toBe(0);
  });
});

describe("isDue", () => {
  const now = new Date("2026-08-04T08:30:00Z");

  it("considère une première tentative (sans date) comme due", () => {
    expect(isDue(null, now)).toBe(true);
  });

  it("considère une échéance passée comme due", () => {
    expect(isDue(new Date("2026-08-04T08:00:00Z"), now)).toBe(true);
  });

  it("tolère 5 minutes d'avance pour ne pas manquer le tick de la demi-heure", () => {
    // Créneau ouvert à 8h00:03, donc retry daté à 8h30:03, alors que le tick
    // tombe à 8h30:00 : sans tolérance il serait repoussé à 9h00.
    expect(isDue(new Date("2026-08-04T08:30:03Z"), now)).toBe(true);
  });

  it("ne déclenche pas une échéance nettement future", () => {
    expect(isDue(new Date("2026-08-04T09:00:00Z"), now)).toBe(false);
  });
});

describe("nextRunState", () => {
  const now = new Date("2026-08-04T08:00:00Z");

  it("planifie une deuxième tentative 30 minutes après le premier échec", () => {
    const state = nextRunState(0, now);

    expect(state.status).toBe("pending");
    expect(state.attempts).toBe(1);
    expect(state.nextAttemptAt?.getTime()).toBe(now.getTime() + RETRY_DELAY_MS);
  });

  it("planifie une troisième tentative après le deuxième échec", () => {
    const state = nextRunState(1, now);

    expect(state.status).toBe("pending");
    expect(state.attempts).toBe(2);
    expect(state.nextAttemptAt?.getTime()).toBe(now.getTime() + RETRY_DELAY_MS);
  });

  it("abandonne le créneau au troisième échec", () => {
    const state = nextRunState(MAX_ATTEMPTS - 1, now);

    expect(state.status).toBe("failed");
    expect(state.attempts).toBe(MAX_ATTEMPTS);
    expect(state.nextAttemptAt).toBeNull();
  });
});
