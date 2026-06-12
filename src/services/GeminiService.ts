import { GoogleGenerativeAI } from "@google/generative-ai";
import { LoggerService } from "./LoggerService";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { DEFAULT_LANGUAGE, type Language } from "./GuildSettingsService";

export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  /** Nom de la langue cible, pour la directive de rédaction envoyée à Gemini. */
  private static readonly LANGUAGE_NAMES: Record<Language, string> = {
    fr: "français",
    en: "anglais (English)",
    es: "espagnol (español)",
    de: "allemand (Deutsch)",
    it: "italien (italiano)",
  };

  private static initialize() {
    if (!this.genAI && config.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    }
  }

  /**
   * Tente de réparer un JSON malformé retourné par Gemini
   */
  private static repairJson(json: string): string {
    let fixed = json;
    // Supprimer les virgules en trop avant ] ou }
    fixed = fixed.replace(/,\s*([\]}])/g, "$1");
    // Supprimer les caractères de contrôle non échappés dans les strings
    fixed = fixed.replace(/(?<=:\s*"(?:[^"\\]|\\.)*)[\x00-\x1f](?=[^"]*")/g, " ");
    // Remplacer les sauts de ligne non échappés dans les valeurs string
    fixed = fixed.replace(/"([^"]*?)"/g, (_match, content: string) => {
      return `"${content.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
    });
    return fixed;
  }

  /**
   * Récupère tous les titres des anecdotes déjà envoyées pour un serveur spécifique
   */
  private static async getSentAnecdoteTitles(guildId: string): Promise<string[]> {
    const sentAnecdotes = await prisma.sentAnecdote.findMany({
      where: { guildId },
      select: { title: true },
      orderBy: { sentAt: "desc" },
    });
    return sentAnecdotes.map((a) => a.title);
  }

  /**
   * Génère une anecdote informatique intéressante via Gemini
   * @param guildId L'identifiant du serveur pour filtrer les anecdotes déjà envoyées
   */
  public static async generateTechAnecdote(guildId: string, language: Language = DEFAULT_LANGUAGE): Promise<{ title: string; paragraphs: string[]; sources: { name: string; url: string }[] } | null> {
    try {
      this.initialize();

      if (!this.genAI) {
        await LoggerService.warning("GEMINI_API_KEY non configurée");
        return null;
      }

      const languageName = this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE];
      const languageDirective = `\n\n🌍 LANGUE OBLIGATOIRE : rédige le titre ET tous les paragraphes en ${languageName}. Les sources peuvent rester dans leur langue d'origine.`;

      // Récupérer les titres déjà envoyés pour ce serveur
      const sentTitles = await this.getSentAnecdoteTitles(guildId);
      const titlesContext = sentTitles.length > 0
        ? `\n\n⛔ TITRES INTERDITS - Ces anecdotes ont DÉJÀ été envoyées sur ce serveur. Tu ne dois ABSOLUMENT PAS les répéter, ni parler des mêmes sujets, ni reformuler ces anecdotes :\n${sentTitles.map((t) => `- "${t}"`).join("\n")}\n\nChoisis un sujet COMPLÈTEMENT DIFFÉRENT de ceux listés ci-dessus.`
        : "";

      // Liste de modèles à essayer dans l'ordre (fallback si l'un est surchargé)
      const modelNames = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
      ];

      const prompt = `Génère une anecdote fascinante et peu connue sur l'informatique, la technologie ou l'histoire du numérique.

Critères :
- L'anecdote doit être vraie et vérifiable
- Elle doit être intéressante et surprenante
- Évite les faits trop connus (comme "Bill Gates a créé Microsoft")
- VARIE les sujets pour ne pas parler toujours de la même chose

Sujets suggérés (choisis-en un au hasard, varie les thèmes) :
- Histoire de l'informatique et anecdotes historiques fascinantes
- Bugs célèbres et leurs conséquences inattendues
- Innovations qui ont changé le monde
- Personnalités tech méconnues et leurs contributions
- Langages de programmation et leurs origines surprenantes
- Jeux vidéo cultes et leur développement
- Valve et Steam (histoire, Steam Deck, Half-Life, Portal, Counter-Strike, etc.)
- Internet et le Web (premières pages, protocoles, culture internet)
- Matériel informatique (processeurs, mémoire, stockage)
- Systèmes d'exploitation et leur évolution
- Cryptographie et sécurité informatique
- Grandes entreprises tech et leur histoire
- Open source et logiciels libres
- Compétitions de programmation et hackatons
- Easter eggs et secrets cachés dans les logiciels
- Événements marquants de l'industrie tech

Tu peux aussi parler occasionnellement de sujets récents (2023-2025) mais sans en faire une priorité :
- Actualité technologique récente si elle est vraiment marquante
- Nouvelles innovations significatives
${titlesContext}

Format de réponse (très important, respecte exactement ce format JSON) :
{
  "title": "Un titre accrocheur pour l'anecdote (sans emoji)",
  "paragraphs": [
    "Premier paragraphe de l'anecdote (2-3 phrases)",
    "Deuxième paragraphe avec plus de détails (2-3 phrases)",
    "Troisième paragraphe avec la conclusion ou l'impact (2-3 phrases)"
  ],
  "sources": [
    {
      "name": "Nom de la source (ex: Wikipedia, site officiel, article, etc.)",
      "url": "URL complète de la source vérifiable"
    }
  ]
}

IMPORTANT : Fournis toujours au moins une source vérifiable avec une URL réelle où l'utilisateur peut vérifier l'anecdote.
${languageDirective}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

      const MAX_RETRIES_PER_MODEL = 2;

      for (const modelName of modelNames) {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
          try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Parser la réponse JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt}: pas de JSON valide`);
              continue;
            }

            let raw: any;
            try {
              raw = JSON.parse(jsonMatch[0]);
            } catch {
              try {
                raw = JSON.parse(this.repairJson(jsonMatch[0]));
                await LoggerService.info(`JSON réparé avec succès [${modelName}] tentative ${attempt}`);
              } catch {
                await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt}: JSON malformé impossible à réparer`);
                continue;
              }
            }

            if (!raw.title || typeof raw.title !== "string" || raw.title.trim().length === 0) {
              await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt}: titre manquant`);
              continue;
            }

            if (!Array.isArray(raw.paragraphs) || raw.paragraphs.length < 3) {
              await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt}: paragraphes manquants`);
              continue;
            }

            const validParagraphs = raw.paragraphs
              .filter((p: unknown) => typeof p === "string" && p.trim().length > 0)
              .slice(0, 3);

            if (validParagraphs.length < 3) {
              await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt}: paragraphes insuffisants`);
              continue;
            }

            const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
            const validSources = rawSources.filter((s: unknown) => {
              if (!s || typeof (s as any).name !== "string" || typeof (s as any).url !== "string") return false;
              try {
                const url = new URL((s as any).url);
                return url.protocol === "http:" || url.protocol === "https:";
              } catch {
                return false;
              }
            }).slice(0, 5);

            if (modelName !== modelNames[0]) {
              await LoggerService.info(`Anecdote générée via modèle de fallback [${modelName}]`);
            }

            return {
              title: raw.title.trim(),
              paragraphs: validParagraphs,
              sources: validSources.length > 0 ? validSources : [
                { name: "Généré par IA (Gemini)", url: "https://ai.google.dev/gemini-api" }
              ],
            };
          } catch (error) {
            const errStr = String(error);
            const isOverloaded = /\b(503|429|overload|unavailable|quota|rate.?limit)/i.test(errStr);

            await LoggerService.warning(`Gemini [${modelName}] tentative ${attempt} échouée: ${errStr.substring(0, 200)}`);

            if (isOverloaded) {
              // Surcharge : passer directement au modèle suivant
              break;
            }

            // Backoff exponentiel avant retry sur le même modèle
            if (attempt < MAX_RETRIES_PER_MODEL) {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
          }
        }
      }

      await LoggerService.error(`Gemini: tous les modèles de fallback ont échoué`);
      return null;
    } catch (error) {
      await LoggerService.error(`Erreur lors de la génération avec Gemini: ${error}`);
      return null;
    }
  }
}
