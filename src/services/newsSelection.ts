import { MAX_ITEMS, MIN_ITEMS, type RawFeedItem } from "./newsTypes";

const HOUR_MS = 60 * 60 * 1000;
/** Fenêtre de fraîcheur nominale. */
const FRESH_WINDOW_MS = 24 * HOUR_MS;
/** Fenêtre élargie, utilisée quand la fenêtre nominale ne suffit pas. */
const WIDE_WINDOW_MS = 48 * HOUR_MS;

/** Articles publiés dans la fenêtre donnée. Un article sans date est écarté. */
function withinWindow(items: RawFeedItem[], now: Date, windowMs: number): RawFeedItem[] {
  const floor = now.getTime() - windowMs;
  return items.filter((item) => {
    if (!item.publishedAt) return false;
    const time = item.publishedAt.getTime();
    return time >= floor && time <= now.getTime();
  });
}

/** Retire les URLs déjà publiées et les doublons internes, en gardant l'ordre. */
function dedupe(items: RawFeedItem[], sentUrls: Set<string>): RawFeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (sentUrls.has(item.url) || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/**
 * Répartit la sélection entre les sources : un article de chaque source à tour
 * de rôle, du plus récent au plus ancien à l'intérieur d'une source. Évite
 * qu'un flux prolifique monopolise le digest.
 */
function roundRobinBySource(items: RawFeedItem[], limit: number): RawFeedItem[] {
  const bySource = new Map<string, RawFeedItem[]>();

  for (const item of items) {
    const bucket = bySource.get(item.source);
    if (bucket) {
      bucket.push(item);
    } else {
      bySource.set(item.source, [item]);
    }
  }

  for (const bucket of bySource.values()) {
    bucket.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  }

  const buckets = [...bySource.values()];
  const selected: RawFeedItem[] = [];

  for (let round = 0; selected.length < limit; round++) {
    let picked = false;

    for (const bucket of buckets) {
      if (selected.length >= limit) break;
      const item = bucket[round];
      if (item) {
        selected.push(item);
        picked = true;
      }
    }

    if (!picked) break;
  }

  return selected;
}

/**
 * Choisit les articles d'un digest : fraîcheur 24 h (élargie à 48 h si moins de
 * MIN_ITEMS candidats), exclusion des URLs déjà publiées sur le serveur, puis
 * alternance des sources, dans la limite de MAX_ITEMS.
 */
export function selectItems(items: RawFeedItem[], sentUrls: Set<string>, now: Date): RawFeedItem[] {
  let fresh = dedupe(withinWindow(items, now, FRESH_WINDOW_MS), sentUrls);

  if (fresh.length < MIN_ITEMS) {
    fresh = dedupe(withinWindow(items, now, WIDE_WINDOW_MS), sentUrls);
  }

  return roundRobinBySource(fresh, MAX_ITEMS);
}
