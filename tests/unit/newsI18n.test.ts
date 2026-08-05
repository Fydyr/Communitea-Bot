import { describe, it, expect } from "vitest";
import { t } from "../../src/i18n";
import { fr } from "../../src/i18n/locales/fr";
import { en } from "../../src/i18n/locales/en";
import { es } from "../../src/i18n/locales/es";
import { de } from "../../src/i18n/locales/de";
import { it as itLocale } from "../../src/i18n/locales/it";
import { SUPPORTED_LANGUAGES } from "../../src/services/GuildSettingsService";

const LOCALES = { fr, en, es, de, it: itLocale };

const NEWS_KEYS = [
  "newsSetup.created",
  "newsSetup.updated",
  "newsSetup.error",
  "newsRemove.success",
  "newsRemove.notConfigured",
  "newsList.empty",
  "newsList.title",
  "newsList.footer",
  "newsHour.added",
  "newsHour.exists",
  "newsHour.notPresent",
  "newsHour.removed",
  "newsHour.emptied",
  "news.title",
  "news.footer",
  "news.degraded",
  "news.unverified",
  "news.failed",
  "news.noChannel",
  "news.success",
  "schedule.newsHours",
] as const;

describe("clés i18n des news", () => {
  it("déclare toutes les clés dans les cinq locales", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const key of NEWS_KEYS) {
        expect(LOCALES[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it("interpole les paramètres du titre et du pied de page", () => {
    expect(t("fr", "news.title", { date: "4 août 2026" })).toContain("4 août 2026");
    expect(t("fr", "newsHour.added", { hour: 8, hours: "8h" })).toContain("8h");
  });

  it("conserve les mêmes placeholders dans toutes les langues", () => {
    for (const key of NEWS_KEYS) {
      const expected = [...fr[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const lang of SUPPORTED_LANGUAGES) {
        const actual = [...LOCALES[lang][key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(actual, `${lang}.${key}`).toEqual(expected);
      }
    }
  });
});
