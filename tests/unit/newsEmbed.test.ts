import { describe, it, expect } from "vitest";
import { buildNewsEmbed, formatNewsDate } from "../../src/services/newsEmbed";
import type { NewsDigest } from "../../src/services/newsTypes";

function digest(overrides: Partial<NewsDigest> = {}): NewsDigest {
  return {
    items: [
      { title: "Titre 1", url: "https://a.test/1", summary: "Résumé 1.", source: "a.test" },
      { title: "Titre 2", url: "https://b.test/2", summary: "Résumé 2.", source: "b.test" },
      { title: "Titre 3", url: "https://a.test/3", summary: "Résumé 3.", source: "a.test" },
    ],
    tier: "rss",
    degraded: false,
    ...overrides,
  };
}

describe("formatNewsDate", () => {
  it("formate la date dans la langue et le fuseau du serveur", () => {
    const label = formatNewsDate("fr", "Europe/Paris", new Date("2026-08-04T12:00:00Z"));
    expect(label).toContain("2026");
    expect(label).toContain("août");
  });

  it("tient compte du fuseau pour la date affichée", () => {
    const instant = new Date("2026-08-04T23:30:00Z");
    expect(formatNewsDate("en", "UTC", instant)).toContain("4");
    expect(formatNewsDate("en", "Asia/Tokyo", instant)).toContain("5");
  });
});

describe("buildNewsEmbed", () => {
  it("liste les articles numérotés avec leurs liens", () => {
    const embed = buildNewsEmbed(digest(), "fr", "4 août 2026").toJSON();

    expect(embed.title).toContain("4 août 2026");
    expect(embed.description).toContain("**1. [Titre 1](https://a.test/1)**");
    expect(embed.description).toContain("Résumé 1.");
    expect(embed.description).toContain("**3. [Titre 3](https://a.test/3)**");
  });

  it("liste les sources dédoublonnées dans le pied de page", () => {
    const embed = buildNewsEmbed(digest(), "fr", "4 août 2026").toJSON();

    expect(embed.footer?.text).toContain("a.test");
    expect(embed.footer?.text).toContain("b.test");
    expect(embed.footer?.text.match(/a\.test/g)).toHaveLength(1);
  });

  it("n'ajoute aucun avertissement pour un digest RSS normal", () => {
    const embed = buildNewsEmbed(digest(), "fr", "4 août 2026").toJSON();
    expect(embed.fields ?? []).toHaveLength(0);
  });

  it("signale le mode dégradé", () => {
    const embed = buildNewsEmbed(digest({ degraded: true }), "fr", "4 août 2026").toJSON();
    expect(embed.fields?.[0].value).toContain("Résumés automatiques indisponibles");
  });

  it("signale un contenu généré sans recherche web", () => {
    const embed = buildNewsEmbed(digest({ tier: "generated" }), "fr", "4 août 2026").toJSON();
    expect(embed.fields?.[0].value).toContain("sans recherche web");
  });

  it("omet le tiret quand l'article n'a pas de résumé", () => {
    const noSummary = digest({
      items: [{ title: "Titre", url: "https://a.test/1", summary: "", source: "a.test" }],
    });

    expect(buildNewsEmbed(noSummary, "fr", "4 août 2026").toJSON().description).toBe(
      "**1. [Titre](https://a.test/1)**"
    );
  });

  it("tronque la description à la limite Discord de 4096 caractères", () => {
    const long = digest({
      items: Array.from({ length: 5 }, (_unused, index) => ({
        title: "T".repeat(200),
        url: `https://a.test/${index}`,
        summary: "R".repeat(1200),
        source: "a.test",
      })),
    });

    const description = buildNewsEmbed(long, "fr", "4 août 2026").toJSON().description ?? "";
    expect(description.length).toBeLessThanOrEqual(4096);
  });

  it("tronque le pied de page à 2048 caractères", () => {
    const many = digest({
      items: Array.from({ length: 5 }, (_unused, index) => ({
        title: `T${index}`,
        url: `https://s${index}.test/1`,
        summary: "R.",
        source: `${"s".repeat(600)}${index}.test`,
      })),
    });

    const footer = buildNewsEmbed(many, "fr", "4 août 2026").toJSON().footer?.text ?? "";
    expect(footer.length).toBeLessThanOrEqual(2048);
  });

  it("reste dans la limite totale Discord de 6000 caractères (footer saturé)", () => {
    // Fixture qui teste la limite globale 6000 : sources distinctes (footer saturé) + avertissement
    const saturated = digest({
      items: Array.from({ length: 5 }, (_unused, index) => ({
        title: "T".repeat(1500),
        url: `https://example${index}.com/article`,
        summary: "S".repeat(50),
        source: `${"s".repeat(400)}${index}.test`, // source distincte et longue pour saturer le footer
      })),
      degraded: true, // ajoute un champ d'avertissement
    });

    const embed = buildNewsEmbed(saturated, "fr", "4 août 2026").toJSON();
    const titleLength = embed.title?.length ?? 0;
    const descriptionLength = embed.description?.length ?? 0;
    const footerLength = embed.footer?.text?.length ?? 0;
    // Inclure la longueur du nom du champ (zéro-width space = 1 char) et de la valeur
    const fieldsLength = (embed.fields ?? []).reduce((sum, field) => {
      return sum + (field.name?.length ?? 0) + (field.value?.length ?? 0);
    }, 0);

    const totalLength = titleLength + descriptionLength + footerLength + fieldsLength;
    expect(totalLength).toBeLessThanOrEqual(6000);
  });

  it("ne tranche pas les liens markdown (fixture saturée)", () => {
    // Même fixture que le test précédent : avec l'ancien code, la coupure à 4096 chars
    // tombait au milieu du titre de l'article 3, laissant un crochet ouvrant sans fermeture.
    // Le nouveau code tronque au niveau d'articles complets, préservant tous les liens.
    const saturated = digest({
      items: Array.from({ length: 5 }, (_unused, index) => ({
        title: "T".repeat(1500),
        url: `https://example${index}.com/article`,
        summary: "S".repeat(50),
        source: `${"s".repeat(400)}${index}.test`,
      })),
      degraded: true,
    });

    const description = buildNewsEmbed(saturated, "fr", "4 août 2026").toJSON().description ?? "";
    // Avec l'ancien code, on aurait 3 crochets ouvrants et 2 fermants (coupure dans un lien).
    // Vérifie que le nombre de crochets est équilibré (discrimine la troncature fine).
    const openBrackets = (description.match(/\[/g) ?? []).length;
    const closeBrackets = (description.match(/\]/g) ?? []).length;
    expect(openBrackets).toBe(closeBrackets);
    // Vérifie aussi l'équilibre des parenthèses (syntaxe URL)
    const openParens = (description.match(/\(/g) ?? []).length;
    const closeParens = (description.match(/\)/g) ?? []).length;
    expect(openParens).toBe(closeParens);
  });

  it("neutralise une tentative d'injection de lien dans un titre de flux", () => {
    // Titre tel qu'un utilisateur peut le soumettre sur dev.to ou Hacker News.
    const piege = digest({
      items: [
        {
          title: "Rust 2.0 released](https://phishing.example/steal) — (",
          url: "https://vrai.test/article",
          summary: "",
          source: "vrai.test",
        },
      ],
    });

    const description = buildNewsEmbed(piege, "fr", "4 août 2026").toJSON().description ?? "";

    // Les crochets et parenthèses du titre sont échappés : ils ne peuvent plus
    // fermer le lien courant ni en ouvrir un second.
    expect(description).toContain("Rust 2.0 released\\]\\(https://phishing.example/steal\\) — \\(");
    // Aucune séquence `](` non échappée ne subsiste dans le titre : le seul
    // `](` du rendu est celui du lien légitime construit par le module.
    expect((description.match(/(?<!\\)\]\(/g) ?? []).length).toBe(1);
    // La cible du lien reste l'URL réelle de l'article.
    expect(description).toContain("](https://vrai.test/article)");
    expect(description).not.toContain("](https://phishing.example/steal)");
  });

  it("neutralise le formatage markdown injecté dans un titre", () => {
    const piege = digest({
      items: [
        { title: "Le *gras*, le `code` et le ||spoiler||", url: "https://a.test/1", summary: "", source: "a.test" },
      ],
    });

    const description = buildNewsEmbed(piege, "fr", "4 août 2026").toJSON().description ?? "";

    expect(description).toContain("Le \\*gras\\*, le \\`code\\` et le \\|\\|spoiler\\|\\|");
    // Aucune étoile, backtick ou barre verticale non échappée dans la portion
    // « libellé du lien » (entre `[` et `](`), la seule qui vienne du flux.
    const label = description.slice(description.indexOf("[") + 1, description.indexOf("]("));
    expect(/(?<!\\)[*`|]/.test(label)).toBe(false);
  });

  it("échappe aussi le résumé, qui vient lui aussi du flux ou du modèle", () => {
    const piege = digest({
      items: [
        {
          title: "Titre sobre",
          url: "https://a.test/1",
          summary: "Voir [x](https://phishing.example) pour la suite.",
          source: "a.test",
        },
      ],
    });

    const description = buildNewsEmbed(piege, "fr", "4 août 2026").toJSON().description ?? "";

    expect(description).toContain("Voir \\[x\\]\\(https://phishing.example\\) pour la suite.");
    expect(description).not.toContain("[x](https://phishing.example)");
  });

  it("laisse intact un titre sans caractère spécial (pas de sur-échappement)", () => {
    const normal = digest({
      items: [
        {
          title: "Node.js 26 sort en version stable",
          url: "https://a.test/1",
          summary: "La version 26 apporte un nouveau moteur de modules.",
          source: "a.test",
        },
      ],
    });

    expect(buildNewsEmbed(normal, "fr", "4 août 2026").toJSON().description).toBe(
      "**1. [Node.js 26 sort en version stable](https://a.test/1)** — La version 26 apporte un nouveau moteur de modules."
    );
  });

  it("encode les caractères qui casseraient la cible du lien", () => {
    const bancal = digest({
      items: [
        { title: "Titre", url: "https://a.test/wiki/Foo_(bar)", summary: "", source: "a.test" },
      ],
    });

    const description = buildNewsEmbed(bancal, "fr", "4 août 2026").toJSON().description ?? "";

    expect(description).toBe("**1. [Titre](https://a.test/wiki/Foo_%28bar%29)**");
  });

  it("ne lance pas d'erreur avec un digest vide", () => {
    expect(() =>
      buildNewsEmbed({ items: [], tier: "rss", degraded: false }, "fr", "4 août 2026")
    ).not.toThrow();
  });
});
