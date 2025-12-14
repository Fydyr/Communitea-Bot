import { GoogleGenerativeAI } from "@google/generative-ai";
import { LoggerService } from "./LoggerService";

export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static initialize() {
    if (!this.genAI && process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  private static async listAvailableModels() {
    try {
      if (!this.genAI) return;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
      );
      const data: any = await response.json();
      await LoggerService.info(`Modèles disponibles: ${data.models?.map((m: any) => m.name).join(", ")}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la récupération des modèles: ${error}`);
    }
  }

  /**
   * Génère une anecdote informatique intéressante via Gemini
   */
  public static async generateTechAnecdote(): Promise<{ title: string; paragraphs: string[]; sources: { name: string; url: string }[] } | null> {
    try {
      this.initialize();

      if (!this.genAI) {
        await LoggerService.warning("GEMINI_API_KEY non configurée");
        return null;
      }

      // Liste des modèles pour debug
      // await this.listAvailableModels();

      // Utiliser gemini-2.5-flash qui a un meilleur quota gratuit
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Génère une anecdote fascinante et peu connue sur l'informatique, la technologie ou l'histoire du numérique.

Critères :
- L'anecdote doit être vraie et vérifiable
- Elle doit être intéressante et surprenante
- Évite les faits trop connus (comme "Bill Gates a créé Microsoft")

PRIORITÉ ABSOLUE - Sujets d'actualité informatique (2023-2025) :
- Intelligence artificielle (ChatGPT, Claude, Gemini, LLMs, etc.)
- Cybersécurité récente (failles de sécurité, ransomwares, piratages célèbres)
- Nouvelles technologies (ordinateurs quantiques, blockchain, Web3)
- Actualité des grandes entreprises tech (Meta, Google, OpenAI, Microsoft, Apple, etc.)
- Nouveaux langages et frameworks populaires
- Événements tech récents marquants
- Innovations matérielles (nouveaux processeurs, GPUs, etc.)
- Actualité des jeux vidéo (nouveaux jeux, mises à jour majeures, événements gaming)
- Valve et Steam (nouveautés, Steam Deck, Half-Life, Portal, Counter-Strike, etc.)
- Industrie du jeu vidéo (moteurs de jeu, technologies graphiques, VR/AR gaming)

Si aucun sujet d'actualité récente n'est disponible, tu peux aussi parler de :
- Détails historiques fascinants de l'informatique
- Bugs célèbres et leurs conséquences
- Innovations qui ont changé le monde
- Personnalités tech méconnues
- Anecdotes sur : langages de programmation, jeux vidéo, internet, etc.

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

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parser la réponse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        await LoggerService.error(`Gemini n'a pas retourné de JSON valide: ${text.substring(0, 200)}`);
        return null;
      }

      const anecdote = JSON.parse(jsonMatch[0]);

      if (!anecdote.title || !anecdote.paragraphs || anecdote.paragraphs.length < 3) {
        await LoggerService.error(`Format de réponse Gemini invalide: ${JSON.stringify(anecdote)}`);
        return null;
      }

      // Si Gemini n'a pas fourni de sources, ajouter une source par défaut
      if (!anecdote.sources || anecdote.sources.length === 0) {
        anecdote.sources = [
          {
            name: "Généré par IA (Gemini)",
            url: "https://ai.google.dev/gemini-api"
          }
        ];
      }

      return anecdote;
    } catch (error) {
      await LoggerService.error(`Erreur lors de la génération avec Gemini: ${error}`);
      return null;
    }
  }
}
