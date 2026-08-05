import { EmbedBuilder } from "discord.js";
import { t } from "../i18n";
import type { Language } from "./GuildSettingsService";
import type { NewsDigest } from "./newsTypes";

// Limites Discord.
const DESCRIPTION_LIMIT = 4096;
const FOOTER_LIMIT = 2048;

/**
 * Caractères qui ouvrent une construction markdown dans Discord : lien
 * (`[` `]` `(` `)`), gras/italique (`*` `_`), barré (`~`), spoiler (`|`),
 * code (`` ` ``) et l'échappement lui-même (`\`).
 */
const MARKDOWN_SPECIALS = /[\\`*_~|[\]()]/g;

/**
 * Échappe le markdown d'un texte issu d'un flux RSS ou d'une réponse du
 * modèle.
 *
 * POURQUOI : titres et résumés sont du contenu NON FIABLE — dev.to et Hacker
 * News (présent dans la liste de flux par défaut) publient des titres soumis
 * par leurs utilisateurs, et Gemini ne valide que le protocole des URLs, pas
 * le texte. Ce contenu arrive verbatim dans la description de l'embed, que
 * Discord interprète comme du markdown. Sans échappement, un titre contenant
 * `](https://phishing.example)` referme le lien du digest et en ouvre un
 * second : le bot publierait un lien d'hameçonnage sous son propre nom, avec
 * éventuellement une mention de rôle. L'échappement est fait ici, à la
 * frontière du rendu, pour couvrir d'un seul coup les trois niveaux de la
 * cascade (RSS, recherche Gemini, génération Gemini).
 */
function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIALS, (char) => `\\${char}`);
}

/**
 * Neutralise les caractères qui cassent la syntaxe d'une cible de lien.
 *
 * POURQUOI : la cible d'un lien markdown se termine à la première parenthèse
 * fermante ; une URL contenant `)`, une espace ou des chevrons laisse le
 * reste de la ligne être réinterprété par Discord. Le protocole de l'URL est
 * déjà validé en amont (`isHttpUrl` côté Gemini, parsing du flux côté RSS) :
 * on ne protège ici que la syntaxe, par un encodage pourcent qui préserve la
 * destination réelle.
 *
 * L'encodage est fait à la main : `encodeURIComponent` laisse justement `(`
 * et `)` intacts, puisqu'ils sont autorisés dans une URL.
 */
function sanitizeLinkTarget(url: string): string {
  return url.replace(/[()<>\s]/g, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x80 ? `%${code.toString(16).toUpperCase().padStart(2, "0")}` : encodeURIComponent(char);
  });
}

/** Date du jour formatée dans la langue et le fuseau du serveur. */
export function formatNewsDate(language: Language, timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat(language, {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

/**
 * Construit l'embed d'un digest. L'auteur (avatar du bot) est ajouté par
 * l'appelant : ce module reste utilisable sans client Discord connecté.
 */
export function buildNewsEmbed(digest: NewsDigest, language: Language, dateLabel: string): EmbedBuilder {
  const TOTAL_LIMIT = 6000;
  const SAFETY_MARGIN = 16; // marge pour le nom du champ et les séparateurs

  // Construire le titre
  const titleText = t(language, "news.title", { date: dateLabel }).slice(0, 256);

  // Construire le pied de page
  const sources = [...new Set(digest.items.map((item) => item.source))];
  const footerText = t(language, "news.footer", { sources: sources.join(" | ") }).slice(0, FOOTER_LIMIT);

  // Déterminer le texte d'avertissement (le cas échéant)
  let warningText = "";
  if (digest.degraded) {
    warningText = t(language, "news.degraded");
  } else if (digest.tier === "generated") {
    warningText = t(language, "news.unverified");
  }

  // Calculer le budget pour la description
  const budget = Math.min(
    DESCRIPTION_LIMIT,
    TOTAL_LIMIT - titleText.length - footerText.length - warningText.length - SAFETY_MARGIN
  );

  // Assembler la description ligne par ligne, en gardant les articles entiers
  const lines = digest.items.map((item, index) => {
    const heading = `**${index + 1}. [${escapeMarkdown(item.title)}](${sanitizeLinkTarget(item.url)})**`;
    return item.summary ? `${heading} — ${escapeMarkdown(item.summary)}` : heading;
  });

  let description = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const separator = i === 0 ? "" : "\n\n";
    const candidate = description + separator + line;

    if (candidate.length <= budget) {
      description = candidate;
    } else {
      // La ligne suivante dépasse le budget. Si c'est la première ligne, la tronquer en dernier recours.
      if (i === 0) {
        // Dernier recours : tronquer la première ligne. Le lien peut être cassé.
        description = line.slice(0, budget);
      }
      break;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(titleText)
    .setColor(0x5865F2)
    .setTimestamp();

  // N'ajouter la description que si elle est non-vide (Discord rejette une description vide)
  if (description) {
    embed.setDescription(description);
  }

  embed.setFooter({ text: footerText });

  if (warningText) {
    embed.addFields({ name: "​", value: warningText });
  }

  return embed;
}
