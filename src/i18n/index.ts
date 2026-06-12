import { DEFAULT_LANGUAGE, type Language } from "../services/GuildSettingsService";
import { fr, type MessageKey } from "./locales/fr";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { de } from "./locales/de";
import { it } from "./locales/it";

export type { MessageKey } from "./locales/fr";

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { fr, en, es, de, it };

/** Nom de chaque langue dans sa propre langue (pour l'affichage). */
export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
};

/**
 * Traduit une clé dans la langue donnée, avec interpolation simple des
 * paramètres `{nom}`. Retombe sur le français si la clé ou la langue manque.
 */
export function t(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANGUAGE];
  let template = dict[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      template = template.replaceAll(`{${name}}`, String(value));
    }
  }

  return template;
}
