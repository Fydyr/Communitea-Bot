import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { LoggerService } from "./LoggerService";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { DEFAULT_LANGUAGE, type Language } from "./GuildSettingsService";
import { repairJson } from "./jsonRepair";
import { shuffleQuizOptions } from "./quizUtils";
import { MIN_ITEMS, MAX_ITEMS, type NewsItem } from "./newsTypes";

export interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

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

  /** Modèles essayés dans l'ordre (fallback si l'un est surchargé). */
  private static readonly MODEL_NAMES = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
  ];

  /**
   * Traduit un texte vers une langue cible (nom en clair, ex. "anglais").
   * Renvoie null si Gemini n'est pas disponible ou échoue.
   */
  public static async translate(text: string, targetLanguageName: string): Promise<string | null> {
    try {
      this.initialize();
      if (!this.genAI) {
        return null;
      }

      const prompt = `Traduis le texte suivant en ${targetLanguageName}. Réponds UNIQUEMENT avec la traduction, sans guillemets, sans préambule ni commentaire.\n\nTexte :\n${text}`;

      for (const modelName of this.MODEL_NAMES) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const translated = result.response.text().trim();
          if (translated.length > 0) {
            return translated;
          }
        } catch (error) {
          const errStr = String(error);
          await LoggerService.warning(`Gemini translate [${modelName}] échec: ${errStr.substring(0, 150)}`);
        }
      }

      return null;
    } catch (error) {
      await LoggerService.error(`Erreur lors de la traduction Gemini: ${error}`);
      return null;
    }
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
   * Récupère toutes les questions de quiz déjà envoyées pour un serveur spécifique
   */
  private static async getSentQuizQuestions(guildId: string): Promise<string[]> {
    const sentQuizzes = await prisma.sentQuiz.findMany({
      where: { guildId },
      select: { question: true },
      orderBy: { sentAt: "desc" },
    });
    return sentQuizzes.map((q) => q.question);
  }

  /** Directive de langue ajoutée aux prompts d'anecdote. */
  private static languageDirective(language: Language): string {
    const languageName = this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE];
    return `\n\n🌍 LANGUE OBLIGATOIRE : rédige le titre ET tous les paragraphes en ${languageName}. Les sources peuvent rester dans leur langue d'origine.`;
  }

  /** Bloc commun décrivant le format JSON attendu. */
  private static readonly JSON_FORMAT_BLOCK = `Format de réponse (très important, respecte exactement ce format JSON) :
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

IMPORTANT : Fournis toujours au moins une source vérifiable avec une URL réelle où l'utilisateur peut vérifier l'anecdote.`;

  /**
   * Génère une anecdote informatique intéressante via Gemini.
   * @param guildId Identifiant du serveur pour filtrer les anecdotes déjà envoyées
   * @param language Langue de rédaction
   * @param themesContext Optionnel : restriction thématique à insérer dans le prompt
   */
  public static async generateTechAnecdote(
    guildId: string,
    language: Language = DEFAULT_LANGUAGE,
    themesContext = ""
  ): Promise<{ title: string; paragraphs: string[]; sources: { name: string; url: string }[] } | null> {
    this.initialize();
    if (!this.genAI) {
      await LoggerService.warning("GEMINI_API_KEY non configurée");
      return null;
    }

    const sentTitles = await this.getSentAnecdoteTitles(guildId);
    const titlesContext = sentTitles.length > 0
      ? `\n\n⛔ TITRES INTERDITS - Ces anecdotes ont DÉJÀ été envoyées sur ce serveur. Tu ne dois ABSOLUMENT PAS les répéter, ni parler des mêmes sujets, ni reformuler ces anecdotes :\n${sentTitles.map((title) => `- "${title}"`).join("\n")}\n\nChoisis un sujet COMPLÈTEMENT DIFFÉRENT de ceux listés ci-dessus.`
      : "";

    const prompt = `Génère une anecdote fascinante et peu connue sur l'informatique, la technologie ou l'histoire du numérique.

Critères :
- L'anecdote doit être vraie et vérifiable
- Elle doit être intéressante et surprenante
- Évite les faits trop connus (comme "Bill Gates a créé Microsoft")
- VARIE les sujets pour ne pas parler toujours de la même chose
${themesContext}${titlesContext}

${this.JSON_FORMAT_BLOCK}
${this.languageDirective(language)}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    return this.runAnecdotePrompt(prompt);
  }

  /**
   * Génère une anecdote sur un sujet imposé (commande à la demande).
   */
  public static async generateAnecdoteAbout(
    topic: string,
    language: Language = DEFAULT_LANGUAGE
  ): Promise<{ title: string; paragraphs: string[]; sources: { name: string; url: string }[] } | null> {
    this.initialize();
    if (!this.genAI) {
      await LoggerService.warning("GEMINI_API_KEY non configurée");
      return null;
    }

    const prompt = `Génère une anecdote fascinante, vraie et peu connue sur le sujet suivant : « ${topic} ».

Critères :
- L'anecdote doit être vraie et vérifiable, et porter précisément sur ce sujet
- Elle doit être intéressante et surprenante
- Reste factuel ; si le sujet est trop vague, choisis un angle précis et marquant

${this.JSON_FORMAT_BLOCK}
${this.languageDirective(language)}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    return this.runAnecdotePrompt(prompt);
  }

  /**
   * Exécute un prompt d'anecdote sur la liste de modèles (avec retries) et
   * parse/valide la réponse JSON.
   */
  private static async runAnecdotePrompt(
    prompt: string
  ): Promise<{ title: string; paragraphs: string[]; sources: { name: string; url: string }[] } | null> {
    if (!this.genAI) {
      return null;
    }

    const MAX_RETRIES_PER_MODEL = 2;

    for (const modelName of this.MODEL_NAMES) {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();

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
              raw = JSON.parse(repairJson(jsonMatch[0]));
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

          if (modelName !== this.MODEL_NAMES[0]) {
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
            break;
          }

          if (attempt < MAX_RETRIES_PER_MODEL) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }

    await LoggerService.error(`Gemini: tous les modèles de fallback ont échoué`);
    return null;
  }

  /**
   * Génère une question de quiz à choix multiple sur l'informatique/la tech.
   */
  public static async generateQuiz(language: Language = DEFAULT_LANGUAGE, themesContext = "", guildId?: string): Promise<QuizData | null> {
    this.initialize();
    if (!this.genAI) {
      await LoggerService.warning("GEMINI_API_KEY non configurée");
      return null;
    }

    const sentQuestions = guildId ? await this.getSentQuizQuestions(guildId) : [];
    const questionsContext = sentQuestions.length > 0
      ? `\n\n⛔ QUESTIONS INTERDITES - Ces questions ont DÉJÀ été posées sur ce serveur. Tu ne dois ABSOLUMENT PAS les répéter, ni les reformuler, ni poser une question portant sur le même fait précis :\n${sentQuestions.map((question) => `- "${question}"`).join("\n")}\n\nChoisis une question COMPLÈTEMENT DIFFÉRENTE de celles listées ci-dessus.`
      : "";

    const prompt = `Crée une question de quiz à choix multiple, intéressante et factuelle, sur l'informatique, la technologie ou l'histoire du numérique.

Critères :
- La question doit avoir exactement 4 réponses possibles, dont une seule correcte
- Évite les questions trop évidentes
- L'explication justifie brièvement la bonne réponse
${themesContext}${questionsContext}

Format de réponse (respecte exactement ce format JSON) :
{
  "question": "La question",
  "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "correctIndex": 0,
  "explanation": "Pourquoi cette réponse est correcte (1-2 phrases)"
}

🌍 LANGUE OBLIGATOIRE : rédige la question, les 4 options ET l'explication en ${this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE]}.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const raw = await this.runJsonPrompt(prompt);
    if (!raw) {
      return null;
    }

    if (
      typeof raw.question !== "string" ||
      !Array.isArray(raw.options) ||
      raw.options.length !== 4 ||
      !raw.options.every((o: unknown) => typeof o === "string" && o.trim().length > 0) ||
      typeof raw.correctIndex !== "number" ||
      raw.correctIndex < 0 ||
      raw.correctIndex > 3 ||
      typeof raw.explanation !== "string"
    ) {
      await LoggerService.warning("Gemini quiz: structure invalide");
      return null;
    }

    const trimmed = raw.options.map((o: string) => o.trim());
    const shuffled = shuffleQuizOptions(trimmed, Math.floor(raw.correctIndex));

    return {
      question: raw.question.trim(),
      options: shuffled.options,
      correctIndex: shuffled.correctIndex,
      explanation: raw.explanation.trim(),
    };
  }

  /**
   * Exécute un prompt attendant une réponse JSON et renvoie l'objet parsé
   * (avec réparation best-effort), ou null.
   */
  private static async runJsonPrompt(prompt: string): Promise<any | null> {
    if (!this.genAI) {
      return null;
    }

    const MAX_RETRIES_PER_MODEL = 2;

    for (const modelName of this.MODEL_NAMES) {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            continue;
          }

          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            try {
              return JSON.parse(repairJson(jsonMatch[0]));
            } catch {
              continue;
            }
          }
        } catch (error) {
          const errStr = String(error);
          const isOverloaded = /\b(503|429|overload|unavailable|quota|rate.?limit)/i.test(errStr);
          await LoggerService.warning(`Gemini JSON [${modelName}] tentative ${attempt} échouée: ${errStr.substring(0, 150)}`);

          if (isOverloaded) {
            break;
          }
          if (attempt < MAX_RETRIES_PER_MODEL) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }

    return null;
  }

  /** Vérifie qu'une URL est exploitable dans un embed Discord. */
  private static isHttpUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /** Valide et normalise une liste d'articles renvoyée par Gemini. */
  private static normalizeNewsItems(raw: unknown): NewsItem[] {
    if (!Array.isArray(raw)) return [];

    const items: NewsItem[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as Record<string, unknown>;

      if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) continue;
      if (!this.isHttpUrl(candidate.url)) continue;

      items.push({
        title: candidate.title.trim(),
        url: candidate.url,
        summary: typeof candidate.summary === "string" ? candidate.summary.trim() : "",
        source: typeof candidate.source === "string" && candidate.source.trim().length > 0
          ? candidate.source.trim()
          : new URL(candidate.url).hostname.replace(/^www\./, ""),
      });

      if (items.length >= MAX_ITEMS) break;
    }

    return items;
  }

  /**
   * Rédige un résumé d'une à deux phrases par article, dans la langue du
   * serveur. Renvoie null si Gemini échoue ou si le nombre de résumés ne
   * correspond pas au nombre d'articles : l'appelant bascule alors en mode
   * dégradé (titres bruts).
   */
  public static async summarizeNewsItems(
    items: { title: string; description: string; source: string }[],
    language: Language = DEFAULT_LANGUAGE
  ): Promise<string[] | null> {
    this.initialize();
    if (!this.genAI || items.length === 0) {
      return null;
    }

    const languageName = this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE];
    const list = items
      .map((item, index) => `${index + 1}. [${item.source}] ${item.title}\n${item.description}`)
      .join("\n\n");

    const prompt = `Voici ${items.length} articles d'actualité tech. Pour chacun, rédige un résumé d'une à deux phrases, factuel et sans superlatif.

${list}

Format de réponse (respecte exactement ce format JSON) :
{
  "summaries": ["Résumé de l'article 1", "Résumé de l'article 2"]
}

Le tableau doit contenir exactement ${items.length} résumés, dans le même ordre que les articles.

LANGUE OBLIGATOIRE : rédige tous les résumés en ${languageName}, quelle que soit la langue de l'article d'origine.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const raw = await this.runJsonPrompt(prompt);

    if (!raw || !Array.isArray(raw.summaries) || raw.summaries.length !== items.length) {
      await LoggerService.warning("Gemini news: résumés absents ou en nombre incorrect");
      return null;
    }

    if (!raw.summaries.every((s: unknown) => typeof s === "string" && s.trim().length > 0)) {
      await LoggerService.warning("Gemini news: un résumé est vide");
      return null;
    }

    return raw.summaries.map((s: string) => s.trim());
  }

  /**
   * Niveau 2 de la cascade : demande à Gemini les actualités des dernières 24 h
   * en activant la recherche Google.
   *
   * Le SDK installé n'expose que `googleSearchRetrieval`, incompatible avec les
   * modèles Gemini 2.x : on passe donc par l'API REST. Le grounding interdit
   * aussi `responseMimeType: "application/json"`, d'où le parsing tolérant.
   */
  public static async searchNews(
    themesContext = "",
    language: Language = DEFAULT_LANGUAGE
  ): Promise<NewsItem[] | null> {
    if (!config.geminiApiKey) {
      await LoggerService.warning("GEMINI_API_KEY non configurée");
      return null;
    }

    const languageName = this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE];
    const prompt = `Recherche les actualités les plus marquantes des dernières 24 heures dans l'informatique et la technologie.

Critères :
- Uniquement des faits réellement publiés au cours des dernières 24 heures
- Entre ${MIN_ITEMS} et ${MAX_ITEMS} actualités distinctes
- Chaque actualité doit renvoyer vers l'URL réelle de l'article d'origine
${themesContext}

Format de réponse (respecte exactement ce format JSON) :
{
  "items": [
    {
      "title": "Titre de l'actualité",
      "url": "URL complète de l'article source",
      "summary": "Résumé d'une à deux phrases",
      "source": "Nom du média"
    }
  ]
}

LANGUE OBLIGATOIRE : rédige les titres et les résumés en ${languageName}.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    for (const modelName of this.MODEL_NAMES) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.geminiApiKey}`,
          {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          },
          // 20 s suffisent largement pour cet appel. Un timeout plus long
          // multiplié par la cascade de modèles rendait le pire cas (5 × 60 s)
          // plus long que la cadence du planificateur de news.
          { timeout: 20_000, headers: { "Content-Type": "application/json" } }
        );

        const parts = response.data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((part: { text?: string }) => part.text ?? "").join("");

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          await LoggerService.warning(`Gemini search [${modelName}] : pas de JSON dans la réponse`);
          continue;
        }

        let raw: any;
        try {
          raw = JSON.parse(jsonMatch[0]);
        } catch {
          try {
            raw = JSON.parse(repairJson(jsonMatch[0]));
          } catch {
            await LoggerService.warning(`Gemini search [${modelName}] : JSON irréparable`);
            continue;
          }
        }

        const items = this.normalizeNewsItems(raw?.items);
        if (items.length >= MIN_ITEMS) {
          return items;
        }

        await LoggerService.warning(`Gemini search [${modelName}] : moins de ${MIN_ITEMS} articles exploitables`);
      } catch (error) {
        const errStr = String(error);
        // Même classification que `runJsonPrompt` : une surcharge ou un quota
        // est propre au modèle appelé, essayer le suivant a du sens. Toute
        // autre erreur (clé invalide, réseau coupé, timeout) frappera les
        // modèles suivants à l'identique : insister ne ferait qu'allonger le
        // pire cas de la cascade sans aucune chance de succès.
        const isOverloaded = /\b(503|429|overload|unavailable|quota|rate.?limit)/i.test(errStr);
        await LoggerService.warning(
          `Gemini search [${modelName}] échec: ${errStr.substring(0, 200)}`
        );

        if (!isOverloaded) {
          break;
        }
      }
    }

    return null;
  }

  /**
   * Niveau 3 de la cascade : digest produit sans recherche web. Le contenu peut
   * être daté ; l'appelant l'annonce comme non vérifié.
   */
  public static async generateNewsDigest(
    themesContext = "",
    language: Language = DEFAULT_LANGUAGE
  ): Promise<NewsItem[] | null> {
    this.initialize();
    if (!this.genAI) {
      await LoggerService.warning("GEMINI_API_KEY non configurée");
      return null;
    }

    const languageName = this.LANGUAGE_NAMES[language] ?? this.LANGUAGE_NAMES[DEFAULT_LANGUAGE];
    const prompt = `Propose ${MIN_ITEMS} à ${MAX_ITEMS} sujets d'actualité tech marquants et récents, avec pour chacun une source vérifiable.
${themesContext}

Format de réponse (respecte exactement ce format JSON) :
{
  "items": [
    {
      "title": "Titre du sujet",
      "url": "URL complète d'une source vérifiable",
      "summary": "Résumé d'une à deux phrases",
      "source": "Nom du média"
    }
  ]
}

LANGUE OBLIGATOIRE : rédige les titres et les résumés en ${languageName}.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const raw = await this.runJsonPrompt(prompt);
    const items = this.normalizeNewsItems(raw?.items);

    return items.length >= MIN_ITEMS ? items : null;
  }
}
