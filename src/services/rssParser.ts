import { XMLParser } from "fast-xml-parser";
import type { RawFeedItem } from "./newsTypes";

// `link` est un texte en RSS 2.0 mais un attribut `href` en Atom : on demande
// donc les attributs, préfixés pour ne pas entrer en collision avec les nœuds.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/** Normalise un nœud qui peut être absent, unique ou multiple. */
function toArray(node: unknown): any[] {
  if (node === undefined || node === null) return [];
  return Array.isArray(node) ? node : [node];
}

/** Un nœud texte peut être une chaîne, un nombre, ou un objet { "#text": ... }. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in (node as any)) {
    return String((node as any)["#text"]);
  }
  return "";
}

/** Retire les balises HTML et compacte les espaces d'un résumé de flux. */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extrait le href ou le texte d'un candidat `<link>`, quelle que soit sa forme. */
function hrefOrTextOf(candidate: unknown): string {
  if (typeof candidate === "string") return candidate;
  const href = (candidate as any)?.["@_href"];
  if (typeof href === "string") return href;
  return textOf(candidate);
}

/** Attribut `rel` d'un candidat `<link>`, ou `undefined` s'il n'y en a pas (ou pas d'objet). */
function relOf(candidate: unknown): string | undefined {
  if (candidate && typeof candidate === "object") {
    const rel = (candidate as any)["@_rel"];
    if (typeof rel === "string") return rel;
  }
  return undefined;
}

/**
 * Extrait l'URL d'un item : texte en RSS, attribut href en Atom.
 *
 * Un flux Atom peut lister plusieurs `<link>` (self, alternate, hub, replies...) :
 * on préfère la page de l'article (`rel="alternate"`), puis un lien sans `rel`
 * (texte RSS 2.0, ou entrée Atom minimale à lien unique), puis en dernier recours
 * le premier lien exploitable, pour ne jamais publier l'URL du flux XML lui-même.
 */
function linkOf(entry: any): string {
  const link = entry.link;

  if (typeof link === "string") return link;

  const candidates = toArray(link);

  const alternate = candidates.find((candidate) => relOf(candidate) === "alternate");
  if (alternate) {
    const value = hrefOrTextOf(alternate);
    if (value) return value;
  }

  const withoutRel = candidates.find((candidate) => relOf(candidate) === undefined);
  if (withoutRel) {
    const value = hrefOrTextOf(withoutRel);
    if (value) return value;
  }

  for (const candidate of candidates) {
    const value = hrefOrTextOf(candidate);
    if (value) return value;
  }

  return "";
}

/**
 * Parse un flux RSS 2.0 ou Atom en items bruts. Un flux illisible, vide ou
 * inattendu renvoie une liste vide : un flux cassé ne doit jamais faire échouer
 * la récupération des autres.
 */
export function parseFeed(xml: string, source: string): RawFeedItem[] {
  let root: any;
  try {
    root = parser.parse(xml);
  } catch {
    return [];
  }

  if (!root || typeof root !== "object") {
    return [];
  }

  const entries = [
    ...toArray(root?.rss?.channel?.item),
    ...toArray(root?.feed?.entry),
  ];

  const items: RawFeedItem[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const title = stripHtml(textOf(entry.title));
    const url = linkOf(entry).trim();

    if (!title || !isHttpUrl(url)) continue;

    const description = stripHtml(
      textOf(entry.description) || textOf(entry.summary) || textOf(entry["content:encoded"])
    );

    items.push({
      title,
      url,
      description,
      publishedAt: parseDate(textOf(entry.pubDate) || textOf(entry.updated) || textOf(entry.published)),
      source,
    });
  }

  return items;
}
