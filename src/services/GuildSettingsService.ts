import { prisma } from "../lib/prisma";

/**
 * Langues supportées par le bot (contenu des anecdotes + messages i18n).
 */
export const SUPPORTED_LANGUAGES = ["fr", "en", "es", "de", "it"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Valeurs par défaut appliquées aux serveurs sans configuration explicite.
 * Reproduit le comportement historique (8h/20h, Europe/Paris, français).
 */
export const DEFAULT_HOURS: readonly number[] = [8, 20];
export const DEFAULT_TIMEZONE = "Europe/Paris";
export const DEFAULT_LANGUAGE: Language = "fr";

export interface GuildSettingsValues {
  hours: number[];
  timezone: string;
  language: Language;
  /** true si aucune ligne en base : ce sont les valeurs par défaut. */
  isDefault: boolean;
}

export type AddHourResult =
  | { status: "added"; hours: number[] }
  | { status: "exists"; hours: number[] }
  | { status: "invalid" };

export type RemoveHourResult =
  | { status: "removed"; hours: number[]; emptied: boolean }
  | { status: "not-present" };

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function normalizeLanguage(value: string): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function sortHours(hours: number[]): number[] {
  return [...hours].sort((a, b) => a - b);
}

export class GuildSettingsService {
  /** Une heure d'envoi valide est un entier entre 0 et 23. */
  static isValidHour(hour: number): boolean {
    return Number.isInteger(hour) && hour >= 0 && hour <= 23;
  }

  /** Vérifie qu'un identifiant de fuseau IANA est reconnu par l'environnement. */
  static isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  static isValidLanguage(value: string): value is Language {
    return isLanguage(value);
  }

  /**
   * Renvoie la configuration d'un serveur, ou les valeurs par défaut
   * si aucune ligne n'existe.
   */
  static async get(guildId: string): Promise<GuildSettingsValues> {
    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row) {
      return {
        hours: [...DEFAULT_HOURS],
        timezone: DEFAULT_TIMEZONE,
        language: DEFAULT_LANGUAGE,
        isDefault: true,
      };
    }

    return {
      hours: sortHours(row.hours),
      timezone: row.timezone,
      language: normalizeLanguage(row.language),
      isDefault: false,
    };
  }

  /** Raccourci pour récupérer uniquement la langue (utilisé par l'i18n). */
  static async getLanguage(guildId: string): Promise<Language> {
    const row = await prisma.guildSettings.findUnique({
      where: { guildId },
      select: { language: true },
    });
    return row ? normalizeLanguage(row.language) : DEFAULT_LANGUAGE;
  }

  /**
   * Ajoute une heure d'envoi. Sur un serveur sans ligne, crée une
   * configuration partant d'une liste explicite contenant cette seule heure.
   */
  static async addHour(guildId: string, hour: number): Promise<AddHourResult> {
    if (!this.isValidHour(hour)) {
      return { status: "invalid" };
    }

    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row) {
      const created = await prisma.guildSettings.create({
        data: { guildId, hours: [hour] },
      });
      return { status: "added", hours: sortHours(created.hours) };
    }

    if (row.hours.includes(hour)) {
      return { status: "exists", hours: sortHours(row.hours) };
    }

    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { hours: sortHours([...row.hours, hour]) },
    });
    return { status: "added", hours: sortHours(updated.hours) };
  }

  /**
   * Retire une heure d'envoi. Un serveur sans ligne (ou ne contenant pas
   * l'heure) renvoie "not-present" : il faut avoir ajouté l'heure au préalable.
   */
  static async removeHour(guildId: string, hour: number): Promise<RemoveHourResult> {
    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row || !row.hours.includes(hour)) {
      return { status: "not-present" };
    }

    const remaining = sortHours(row.hours.filter((h) => h !== hour));
    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { hours: remaining },
    });

    return { status: "removed", hours: sortHours(updated.hours), emptied: updated.hours.length === 0 };
  }

  /** Définit le fuseau horaire (upsert ; crée la ligne avec les défauts si absente). */
  static async setTimezone(guildId: string, timezone: string): Promise<void> {
    await prisma.guildSettings.upsert({
      where: { guildId },
      update: { timezone },
      create: { guildId, timezone, hours: [...DEFAULT_HOURS] },
    });
  }

  /** Définit la langue (upsert ; crée la ligne avec les défauts si absente). */
  static async setLanguage(guildId: string, language: Language): Promise<void> {
    await prisma.guildSettings.upsert({
      where: { guildId },
      update: { language },
      create: { guildId, language, hours: [...DEFAULT_HOURS] },
    });
  }
}
