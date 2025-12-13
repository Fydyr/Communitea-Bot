import { TextChannel } from "discord.js";
import { bot } from "../index";
import { config } from "../config";
import axios from "axios";
import { LoggerService } from "./LoggerService";

interface Anecdote {
  title: string;
  paragraphs: string[];
  sources: { name: string; url: string }[];
}

export class AnecdoteService {
  private static readonly TECH_TOPICS = [
    "Computer_science",
    "Programming_language",
    "Algorithm",
    "Artificial_intelligence",
    "Internet",
    "Computer_hardware",
    "Software_engineering",
    "Operating_system",
    "Database",
    "Cryptography",
    "Computer_network",
    "Machine_learning",
    "Quantum_computing",
    "Cybersecurity",
    "Cloud_computing",
  ];

  public static async sendDailyAnecdote(): Promise<void> {
    try {
      if (!config.anecdoteChannelId) {
        await LoggerService.error("ANECDOTE_CHANNEL_ID n'est pas configuré dans .env");
        return;
      }

      const channel = await bot.channels.fetch(config.anecdoteChannelId);

      if (!channel || !(channel instanceof TextChannel)) {
        await LoggerService.error("Le canal d'anecdotes n'a pas été trouvé ou n'est pas un canal textuel");
        return;
      }

      // Récupérer une anecdote depuis le web
      const anecdote = await this.fetchAnecdoteFromWeb();

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return;
      }

      // Formater le message
      const message = this.formatAnecdote(anecdote);

      // Envoyer le message
      await channel.send(message);
      await LoggerService.success(`Anecdote quotidienne envoyée : ${anecdote.title}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi de l'anecdote quotidienne: ${error}`);
    }
  }

  private static async fetchAnecdoteFromWeb(): Promise<Anecdote | null> {
    try {
      // Tenter de récupérer des faits depuis plusieurs sources
      const sources = [
        this.fetchFromWikipedia.bind(this),
        this.fetchFromAPIninjas.bind(this),
        this.fetchFromOpenTriviaDB.bind(this),
      ];

      // Essayer chaque source jusqu'à ce qu'une fonctionne
      for (const fetchFn of sources) {
        try {
          const anecdote = await fetchFn();
          if (anecdote) {
            return anecdote;
          }
        } catch (error) {
          // Passer silencieusement à la source suivante
          continue;
        }
      }

      return null;
    } catch (error) {
      await LoggerService.error(`Erreur lors de la récupération de l'anecdote: ${error}`);
      return null;
    }
  }

  private static async fetchFromWikipedia(): Promise<Anecdote | null> {
    try {
      // Choisir un sujet tech aléatoire
      const randomTopic = this.TECH_TOPICS[Math.floor(Math.random() * this.TECH_TOPICS.length)];

      const response = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${randomTopic}`
      );

      if (!response.data || !response.data.extract) {
        return null;
      }

      const data = response.data;
      const title = data.title;
      const extract = data.extract;

      // Diviser le texte en paragraphes (max 3)
      const sentences = extract.match(/[^.!?]+[.!?]+/g) || [extract];
      const paragraphs = [];

      let currentParagraph = "";
      for (const sentence of sentences) {
        if (paragraphs.length >= 3) break;

        currentParagraph += sentence.trim() + " ";

        // Si le paragraphe fait plus de 150 caractères, on le valide
        if (currentParagraph.length > 150) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = "";
        }
      }

      // Ajouter le dernier paragraphe s'il existe
      if (currentParagraph.trim() && paragraphs.length < 3) {
        paragraphs.push(currentParagraph.trim());
      }

      // Si on n'a pas assez de paragraphes, diviser différemment
      if (paragraphs.length === 0) {
        const parts = extract.split(". ");
        paragraphs.push(parts.slice(0, 2).join(". ") + ".");
        if (parts.length > 2) {
          paragraphs.push(parts.slice(2, 4).join(". ") + ".");
        }
      }

      return {
        title: `💻 ${title}`,
        paragraphs: paragraphs.slice(0, 3),
        sources: [
          {
            name: "Wikipedia",
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${randomTopic}`,
          },
        ],
      };
    } catch (error) {
      // Erreur Wikipedia, retour null pour passer à la source suivante
      return null;
    }
  }

  private static async fetchFromAPIninjas(): Promise<Anecdote | null> {
    try {
      // Note: API Ninjas nécessite une clé API gratuite
      // Les utilisateurs devront s'inscrire sur https://api-ninjas.com/
      const apiKey = process.env.API_NINJAS_KEY;

      if (!apiKey) {
        // API_NINJAS_KEY non configurée, passage à la source suivante
        return null;
      }

      const response = await axios.get("https://api.api-ninjas.com/v1/facts?limit=3", {
        headers: { "X-Api-Key": apiKey },
      });

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const facts = response.data;
      const paragraphs = facts.map((fact: { fact: string }) => fact.fact);

      return {
        title: "🔬 Le saviez-vous ?",
        paragraphs: paragraphs.slice(0, 3),
        sources: [
          {
            name: "API Ninjas",
            url: "https://api-ninjas.com/api/facts",
          },
        ],
      };
    } catch (error) {
      // Erreur API Ninjas, retour null pour passer à la source suivante
      return null;
    }
  }

  private static async fetchFromOpenTriviaDB(): Promise<Anecdote | null> {
    try {
      // Catégorie 18 = Science: Computers
      const response = await axios.get(
        "https://opentdb.com/api.php?amount=3&category=18&type=multiple"
      );

      if (!response.data || !response.data.results || response.data.results.length === 0) {
        return null;
      }

      const questions = response.data.results;
      const paragraphs = questions.map((q: any) => {
        const question = this.decodeHTML(q.question);
        const answer = this.decodeHTML(q.correct_answer);
        return `${question} Réponse : ${answer}`;
      });

      return {
        title: "🎯 Quiz informatique du jour",
        paragraphs: paragraphs.slice(0, 3),
        sources: [
          {
            name: "Open Trivia Database",
            url: "https://opentdb.com/",
          },
        ],
      };
    } catch (error) {
      // Erreur OpenTriviaDB, retour null pour passer à la source suivante
      return null;
    }
  }

  private static decodeHTML(html: string): string {
    const entities: { [key: string]: string } = {
      "&quot;": '"',
      "&#039;": "'",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&nbsp;": " ",
    };

    return html.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
  }

  private static formatAnecdote(anecdote: Anecdote): string {
    let message = `# ${anecdote.title}\n`;

    // Ajouter les paragraphes avec le format de citation
    for (const paragraph of anecdote.paragraphs) {
      message += `> \n> ${paragraph}\n`;
    }

    // Ajouter les sources
    message += `> \n`;
    const sourcesLinks = anecdote.sources.map((source) => `[${source.name}](${source.url})`).join(" | ");
    message += `> ${sourcesLinks}\n`;

    // Ajouter la mention du rôle
    message += `>\n> <@&1419413598718918758>`;

    return message;
  }
}
