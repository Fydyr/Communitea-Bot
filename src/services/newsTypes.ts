/** Article brut extrait d'un flux RSS ou Atom, avant résumé. */
export interface RawFeedItem {
  title: string;
  url: string;
  description: string;
  publishedAt: Date | null;
  /** Domaine du flux d'origine, affiché comme nom de source. */
  source: string;
}

/** Article prêt à être publié dans un digest. */
export interface NewsItem {
  title: string;
  url: string;
  summary: string;
  source: string;
}

/** Résultat du sourcing : les articles et la façon dont ils ont été obtenus. */
export interface NewsDigest {
  items: NewsItem[];
  /** Niveau de la cascade ayant abouti. */
  tier: "rss" | "search" | "generated";
  /** true quand les résumés Gemini ont échoué et que seuls les titres sont publiés. */
  degraded: boolean;
}

/** En dessous de ce nombre d'articles, un niveau de la cascade est jugé insuffisant. */
export const MIN_ITEMS = 3;
/** Au-delà, l'embed devient illisible. */
export const MAX_ITEMS = 5;
