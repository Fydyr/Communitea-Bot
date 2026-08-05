import type { Theme } from "./GuildSettingsService";

/**
 * Flux d'actualité par thème, sources anglophones et francophones mêlées :
 * Gemini rédige ensuite le digest dans la langue du serveur.
 *
 * `histoire` porte sur l'histoire de l'informatique et n'a pas de flux
 * d'actualité pertinent : la liste est volontairement vide, les niveaux 2 et 3
 * de la cascade prennent le relais.
 */
export const NEWS_FEEDS_BY_THEME: Record<Theme, string[]> = {
  langages: [
    "https://linuxfr.org/news.atom",
    // Remplace l'ancienne URL https://www.infoq.com/development/rss/ (404) :
    // feed.infoq.com est le flux InfoQ actuel, vérifié par sniff de corps.
    "https://feed.infoq.com/",
    // Flux à volume élevé, nécessaire pour garantir >= 3 articles frais / 24h
    // avant que le palier RSS de la cascade ne soit jugé utilisable.
    "https://dev.to/feed",
  ],
  entreprises: [
    "https://techcrunch.com/feed/",
    "https://www.lemondeinformatique.fr/flux-rss/thematique/business/rss.xml",
  ],
  personnalites: [
    "https://www.theverge.com/rss/index.xml",
    "https://techcrunch.com/feed/",
  ],
  "jeux-video": [
    "https://www.gamedeveloper.com/rss.xml",
    "https://www.jeuxvideo.com/rss/rss-news.xml",
  ],
  securite: [
    "https://feeds.feedburner.com/TheHackersNews",
    "https://krebsonsecurity.com/feed/",
    "https://www.zataz.com/feed/",
  ],
  hardware: [
    "https://www.tomshardware.com/feeds/all",
    "https://www.clubic.com/feed/news.rss",
  ],
  web: [
    "https://hnrss.org/frontpage",
    "https://www.smashingmagazine.com/feed/",
  ],
  ia: [
    "https://www.artificialintelligence-news.com/feed/",
    "https://huggingface.co/blog/feed.xml",
  ],
  histoire: [],
};

/** Flux utilisés quand le serveur n'a imposé aucun thème. */
export const DEFAULT_NEWS_FEEDS: string[] = [
  "https://hnrss.org/frontpage",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://www.lemondeinformatique.fr/flux-rss/thematique/toutes-les-actualites/rss.xml",
];

/**
 * Flux à interroger pour un serveur, dédoublonnés. Une liste de thèmes vide
 * signifie « tous les thèmes » et donne les flux généralistes.
 */
export function feedsForThemes(themes: Theme[]): string[] {
  if (themes.length === 0) {
    return [...DEFAULT_NEWS_FEEDS];
  }

  const urls = new Set<string>();
  for (const theme of themes) {
    for (const url of NEWS_FEEDS_BY_THEME[theme] ?? []) {
      urls.add(url);
    }
  }

  return [...urls];
}
