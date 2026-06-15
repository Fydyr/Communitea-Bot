/**
 * Correspondance emoji-drapeau → langue cible pour la traduction par réaction.
 * `code` sert au fallback ; `name` (en français) est utilisé dans la directive
 * de traduction Gemini et l'affichage.
 */
export interface FlagLanguage {
  code: string;
  name: string;
}

export const FLAG_TO_LANGUAGE: Record<string, FlagLanguage> = {
  "🇫🇷": { code: "fr", name: "français" },
  "🇬🇧": { code: "en", name: "anglais" },
  "🇺🇸": { code: "en", name: "anglais" },
  "🇩🇪": { code: "de", name: "allemand" },
  "🇪🇸": { code: "es", name: "espagnol" },
  "🇮🇹": { code: "it", name: "italien" },
  "🇵🇹": { code: "pt", name: "portugais" },
  "🇧🇷": { code: "pt", name: "portugais (brésilien)" },
  "🇳🇱": { code: "nl", name: "néerlandais" },
  "🇵🇱": { code: "pl", name: "polonais" },
  "🇷🇺": { code: "ru", name: "russe" },
  "🇯🇵": { code: "ja", name: "japonais" },
  "🇨🇳": { code: "zh", name: "chinois" },
  "🇰🇷": { code: "ko", name: "coréen" },
  "🇸🇦": { code: "ar", name: "arabe" },
  "🇹🇷": { code: "tr", name: "turc" },
  "🇸🇪": { code: "sv", name: "suédois" },
  "🇬🇷": { code: "el", name: "grec" },
};
