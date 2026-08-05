import { describe, it, expect } from "vitest";
import { parseFeed } from "../../src/services/rssParser";

const RSS_2 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Exemple</title>
  <item>
    <title>Premier article</title>
    <link>https://exemple.test/a</link>
    <description>Résumé du premier article.</description>
    <pubDate>Mon, 03 Aug 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Second article</title>
    <link>https://exemple.test/b</link>
    <description><![CDATA[Résumé <b>riche</b> du second.]]></description>
    <pubDate>Mon, 03 Aug 2026 12:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Exemple Atom</title>
  <entry>
    <title>Article Atom</title>
    <link href="https://atom.test/x" />
    <summary>Résumé Atom.</summary>
    <updated>2026-08-03T10:00:00Z</updated>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("extrait les items d'un flux RSS 2.0", () => {
    const items = parseFeed(RSS_2, "exemple.test");

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Premier article");
    expect(items[0].url).toBe("https://exemple.test/a");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-08-03T10:00:00.000Z");
    expect(items[0].source).toBe("exemple.test");
  });

  it("nettoie le HTML des descriptions", () => {
    const items = parseFeed(RSS_2, "exemple.test");
    expect(items[1].description).toBe("Résumé riche du second.");
  });

  it("extrait les entrées d'un flux Atom", () => {
    const items = parseFeed(ATOM, "atom.test");

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Article Atom");
    expect(items[0].url).toBe("https://atom.test/x");
    expect(items[0].description).toBe("Résumé Atom.");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-08-03T10:00:00.000Z");
  });

  it("renvoie une liste vide sur un XML malformé plutôt que de lever", () => {
    expect(parseFeed("<rss><channel><item>", "cassé.test")).toEqual([]);
  });

  it("renvoie une liste vide sur un flux sans item", () => {
    expect(parseFeed(`<rss version="2.0"><channel><title>Vide</title></channel></rss>`, "vide.test")).toEqual([]);
  });

  it("ignore les items sans titre ou sans URL http(s)", () => {
    const xml = `<rss version="2.0"><channel>
      <item><title>Sans lien</title></item>
      <item><link>https://ok.test/1</link></item>
      <item><title>Lien non http</title><link>ftp://ok.test/2</link></item>
      <item><title>Valide</title><link>https://ok.test/3</link></item>
    </channel></rss>`;

    const items = parseFeed(xml, "ok.test");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://ok.test/3");
  });

  it("accepte un item unique non encapsulé dans un tableau", () => {
    const xml = `<rss version="2.0"><channel>
      <item><title>Seul</title><link>https://solo.test/1</link></item>
    </channel></rss>`;

    expect(parseFeed(xml, "solo.test")).toHaveLength(1);
  });

  it("laisse publishedAt à null quand la date est absente ou illisible", () => {
    const xml = `<rss version="2.0"><channel>
      <item><title>Sans date</title><link>https://nd.test/1</link><pubDate>pas une date</pubDate></item>
    </channel></rss>`;

    expect(parseFeed(xml, "nd.test")[0].publishedAt).toBeNull();
  });

  it("préfère le lien rel=\"alternate\" quand un lien rel=\"self\" le précède", () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Article multi-liens</title>
    <link rel="self" href="https://feed.test/atom.xml" />
    <link rel="alternate" href="https://feed.test/article" />
    <summary>Résumé.</summary>
  </entry>
</feed>`;

    const items = parseFeed(xml, "feed.test");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://feed.test/article");
  });

  it("utilise le href d'un lien Atom unique sans attribut rel", () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Article sans rel</title>
    <link href="https://sansrel.test/article" />
    <summary>Résumé.</summary>
  </entry>
</feed>`;

    const items = parseFeed(xml, "sansrel.test");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://sansrel.test/article");
  });
});
