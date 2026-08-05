import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";
import { AnecdoteService } from "./AnecdoteService";
import { parseFeed } from "./rssParser";
import { feedsForThemes } from "./newsFeeds";
import { selectItems } from "./newsSelection";
import { MIN_ITEMS, type NewsDigest, type NewsItem, type RawFeedItem } from "./newsTypes";
import type { Language, Theme } from "./GuildSettingsService";

const FEED_TIMEOUT_MS = 8_000;
const FEED_USER_AGENT = "Discord Bot News/1.0 (+https://github.com/Fydyr/discord-bot)";

export class NewsSourceService {
  /** Nom de source lisible déduit de l'URL du flux (ex. "krebsonsecurity.com"). */
  private static sourceNameOf(feedUrl: string): string {
    try {
      return new URL(feedUrl).hostname.replace(/^www\./, "");
    } catch {
      return feedUrl;
    }
  }

  /**
   * Récupère et parse tous les flux, en ignorant ceux qui échouent : un flux
   * mort ne doit pas priver le digest des autres.
   */
  private static async fetchFeeds(feedUrls: string[]): Promise<RawFeedItem[]> {
    const results = await Promise.allSettled(
      feedUrls.map(async (feedUrl) => {
        const response = await axios.get(feedUrl, {
          timeout: FEED_TIMEOUT_MS,
          responseType: "text",
          headers: { "User-Agent": FEED_USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
        });
        return parseFeed(String(response.data), this.sourceNameOf(feedUrl));
      })
    );

    const items: RawFeedItem[] = [];

    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        await LoggerService.warning(
          `Flux RSS injoignable (${feedUrls[index]}): ${String(result.reason).substring(0, 150)}`
        );
      }
    }

    return items;
  }

  /** Niveau 1 : flux RSS, résumés par Gemini, mode dégradé si les résumés échouent. */
  private static async fromRss(
    language: Language,
    themes: Theme[],
    sentUrls: Set<string>,
    now: Date
  ): Promise<NewsDigest | null> {
    const feedUrls = feedsForThemes(themes);
    if (feedUrls.length === 0) {
      return null;
    }

    const raw = await this.fetchFeeds(feedUrls);
    const selected = selectItems(raw, sentUrls, now);

    if (selected.length < MIN_ITEMS) {
      await LoggerService.info(`News RSS : ${selected.length} article(s) exploitable(s), niveau insuffisant`);
      return null;
    }

    const summaries = await GeminiService.summarizeNewsItems(
      selected.map((item) => ({ title: item.title, description: item.description, source: item.source })),
      language
    );

    const items: NewsItem[] = selected.map((item, index) => ({
      title: item.title,
      url: item.url,
      summary: summaries ? summaries[index] : "",
      source: item.source,
    }));

    if (!summaries) {
      await LoggerService.warning("News RSS : résumés indisponibles, publication en mode dégradé");
    }

    return { items, tier: "rss", degraded: summaries === null };
  }

  /** Retire les articles déjà publiés d'une liste renvoyée par Gemini. */
  private static withoutSent(items: NewsItem[], sentUrls: Set<string>): NewsItem[] {
    return items.filter((item) => !sentUrls.has(item.url));
  }

  /**
   * Construit le digest d'un serveur en descendant la cascade : flux RSS, puis
   * Gemini avec recherche Google, puis Gemini seul. Renvoie null si les trois
   * niveaux échouent — c'est ce qui déclenche le retry côté NewsService.
   */
  public static async buildDigest(
    language: Language,
    themes: Theme[],
    sentUrls: Set<string>,
    now: Date = new Date()
  ): Promise<NewsDigest | null> {
    const themesContext = AnecdoteService.buildThemesContext(themes);

    const fromRss = await this.fromRss(language, themes, sentUrls, now);
    if (fromRss) {
      return fromRss;
    }

    const searched = await GeminiService.searchNews(themesContext, language);
    if (searched) {
      const items = this.withoutSent(searched, sentUrls);
      if (items.length >= MIN_ITEMS) {
        return { items, tier: "search", degraded: false };
      }
      await LoggerService.info("News recherche : trop d'articles déjà publiés, passage au niveau suivant");
    }

    const generated = await GeminiService.generateNewsDigest(themesContext, language);
    if (generated) {
      const items = this.withoutSent(generated, sentUrls);
      if (items.length >= MIN_ITEMS) {
        return { items, tier: "generated", degraded: false };
      }
    }

    await LoggerService.error("News : les trois niveaux de sourcing ont échoué");
    return null;
  }
}
