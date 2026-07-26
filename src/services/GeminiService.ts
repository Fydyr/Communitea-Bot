import { GoogleGenerativeAI } from "@google/generative-ai";
import { LoggerService } from "./LoggerService";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { DEFAULT_LANGUAGE, type Language } from "./GuildSettingsService";

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

    // Gemini place presque toujours la bonne réponse en A ou B : on mélange les
    // options (Fisher-Yates) pour répartir la bonne réponse sur les 4 positions.
    const options = raw.options.map((o: string) => o.trim());
    const correctAnswer = options[Math.floor(raw.correctIndex)];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      question: raw.question.trim(),
      options,
      correctIndex: options.indexOf(correctAnswer),
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
              return JSON.parse(this.repairJson(jsonMatch[0]));
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
}
