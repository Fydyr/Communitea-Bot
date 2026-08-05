import { prisma } from "../lib/prisma";

/**
 * Langues supportées par le bot (contenu des anecdotes + messages i18n).
 */
export const SUPPORTED_LANGUAGES = ["fr", "en", "es", "de", "it"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Thèmes d'anecdotes sélectionnables par serveur. Liste vide = tous les thèmes.
 */
export const SUPPORTED_THEMES = [
  "langages",
  "entreprises",
  "personnalites",
  "jeux-video",
  "securite",
  "hardware",
  "web",
  "ia",
  "histoire",
] as const;
export type Theme = (typeof SUPPORTED_THEMES)[number];

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
  themes: Theme[];
  quizHours: number[];
  newsHours: number[];
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

export type AddThemeResult =
  | { status: "added"; themes: Theme[] }
  | { status: "exists"; themes: Theme[] }
  | { status: "invalid" };

export type RemoveThemeResult =
  | { status: "removed"; themes: Theme[] }
  | { status: "not-present" };

/** Champ de type Int[] manipulable via add/remove (heures d'envoi, de quiz ou de news). */
type IntListField = "hours" | "quizHours" | "newsHours";

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function isTheme(value: string): value is Theme {
  return (SUPPORTED_THEMES as readonly string[]).includes(value);
}

function normalizeThemes(values: string[]): Theme[] {
  return values.filter(isTheme);
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
        themes: [],
        quizHours: [],
        newsHours: [],
        isDefault: true,
      };
    }

    return {
      hours: sortHours(row.hours),
      timezone: row.timezone,
      language: normalizeLanguage(row.language),
      themes: normalizeThemes(row.themes),
      quizHours: sortHours(row.quizHours),
      newsHours: sortHours(row.newsHours),
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
   * Ajoute une valeur à un champ Int[] (heures d'envoi ou de quiz). Sur un
   * serveur sans ligne, crée une configuration partant d'une liste explicite
   * contenant cette seule valeur.
   */
  private static async addToIntList(guildId: string, field: IntListField, hour: number): Promise<AddHourResult> {
    if (!this.isValidHour(hour)) {
      return { status: "invalid" };
    }

    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row) {
      const created = await prisma.guildSettings.create({
        data: { guildId, [field]: [hour] },
      });
      return { status: "added", hours: sortHours(created[field]) };
    }

    if (row[field].includes(hour)) {
      return { status: "exists", hours: sortHours(row[field]) };
    }

    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { [field]: sortHours([...row[field], hour]) },
    });
    return { status: "added", hours: sortHours(updated[field]) };
  }

  /**
   * Retire une valeur d'un champ Int[]. Un serveur sans ligne (ou ne contenant
   * pas la valeur) renvoie "not-present".
   */
  private static async removeFromIntList(guildId: string, field: IntListField, hour: number): Promise<RemoveHourResult> {
    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row || !row[field].includes(hour)) {
      return { status: "not-present" };
    }

    const remaining = sortHours(row[field].filter((h) => h !== hour));
    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { [field]: remaining },
    });

    return { status: "removed", hours: sortHours(updated[field]), emptied: updated[field].length === 0 };
  }

  /** Ajoute une heure d'envoi d'anecdote (0-23). */
  static addHour(guildId: string, hour: number): Promise<AddHourResult> {
    return this.addToIntList(guildId, "hours", hour);
  }

  /** Retire une heure d'envoi d'anecdote. */
  static removeHour(guildId: string, hour: number): Promise<RemoveHourResult> {
    return this.removeFromIntList(guildId, "hours", hour);
  }

  /** Ajoute une heure d'envoi de quiz (0-23). */
  static addQuizHour(guildId: string, hour: number): Promise<AddHourResult> {
    return this.addToIntList(guildId, "quizHours", hour);
  }

  /** Retire une heure d'envoi de quiz. */
  static removeQuizHour(guildId: string, hour: number): Promise<RemoveHourResult> {
    return this.removeFromIntList(guildId, "quizHours", hour);
  }

  /** Ajoute une heure d'envoi de news (0-23). */
  static addNewsHour(guildId: string, hour: number): Promise<AddHourResult> {
    return this.addToIntList(guildId, "newsHours", hour);
  }

  /** Retire une heure d'envoi de news. */
  static removeNewsHour(guildId: string, hour: number): Promise<RemoveHourResult> {
    return this.removeFromIntList(guildId, "newsHours", hour);
  }

  static isValidTheme(value: string): value is Theme {
    return isTheme(value);
  }

  /**
   * Ajoute un thème. Sur un serveur sans ligne, crée une configuration partant
   * d'une liste explicite contenant ce seul thème.
   */
  static async addTheme(guildId: string, theme: string): Promise<AddThemeResult> {
    if (!isTheme(theme)) {
      return { status: "invalid" };
    }

    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row) {
      const created = await prisma.guildSettings.create({
        data: { guildId, themes: [theme] },
      });
      return { status: "added", themes: normalizeThemes(created.themes) };
    }

    if (row.themes.includes(theme)) {
      return { status: "exists", themes: normalizeThemes(row.themes) };
    }

    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { themes: [...row.themes, theme] },
    });
    return { status: "added", themes: normalizeThemes(updated.themes) };
  }

  /** Retire un thème. */
  static async removeTheme(guildId: string, theme: string): Promise<RemoveThemeResult> {
    const row = await prisma.guildSettings.findUnique({ where: { guildId } });

    if (!row || !row.themes.includes(theme)) {
      return { status: "not-present" };
    }

    const updated = await prisma.guildSettings.update({
      where: { guildId },
      data: { themes: row.themes.filter((t) => t !== theme) },
    });
    return { status: "removed", themes: normalizeThemes(updated.themes) };
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
