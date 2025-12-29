import { TextChannel, EmbedBuilder, NewsChannel } from "discord.js";
import { bot } from "../index";
import { config } from "../config";
import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";

interface Anecdote {
  title: string;
  paragraphs: string[];
  sources: { name: string; url: string }[];
  imageUrl?: string;
}

export class AnecdoteService {
  private static readonly TECH_TOPICS = [
    // Langages de programmation
    "Python_(langage)", "Java_(langage)", "JavaScript", "C_(langage)", "C%2B%2B",
    "Ruby_(langage)", "PHP", "Rust_(langage)", "Go_(langage)", "TypeScript",

    // Entreprises et personnalités tech
    "Steve_Jobs", "Bill_Gates", "Linus_Torvalds", "Alan_Turing", "Grace_Hopper",
    "Ada_Lovelace", "Tim_Berners-Lee", "Elon_Musk", "Mark_Zuckerberg",
    "Apple", "Microsoft", "Google", "Amazon_(entreprise)", "Meta_(entreprise)",
    "Tesla_(entreprise)", "Netflix", "Nvidia", "Intel", "AMD",

    // Technologies et innovations
    "World_Wide_Web", "Bitcoin", "Blockchain", "ChatGPT", "DeepMind",
    "Linux", "Android", "iOS", "Windows", "MacOS",
    "Cloud_computing", "Machine_learning", "Deep_learning",
    "Réalité_virtuelle", "Réalité_augmentée", "Metaverse",

    // Événements et concepts
    "Bug_de_l'an_2000", "Arpanet", "Premier_ordinateur", "Ordinateur_quantique",
    "Transistor", "Microprocesseur", "Puce_électronique", "RAM_(informatique)",
    "SSD", "GPU", "Internet_des_objets", "5G", "Fibre_optique",

    // Logiciels et plateformes
    "GitHub", "Stack_Overflow", "Reddit", "Discord_(logiciel)", "Slack_(plateforme)",
    "Visual_Studio_Code", "Docker_(logiciel)", "Kubernetes",

    // Jeux vidéo et gaming
    "Minecraft", "Fortnite", "League_of_Legends", "PlayStation", "Xbox",
    "Nintendo", "Steam_(plateforme)", "Twitch_(service)",

    // Sécurité et cyberattaques
    "WannaCry", "Ransomware", "Phishing", "Pare-feu_(informatique)",
    "Chiffrement", "VPN", "Tor_(réseau)"
  ];

  public static async sendDailyAnecdote(): Promise<void> {
    try {
      if (!config.anecdoteChannelId) {
        await LoggerService.error("ANECDOTE_CHANNEL_ID n'est pas configuré dans .env");
        return;
      }

      await LoggerService.info(`🔍 Tentative de récupération du canal: ${config.anecdoteChannelId}`);
      const channel = await bot.channels.fetch(config.anecdoteChannelId);

      if (!channel) {
        await LoggerService.error(`Le canal d'anecdotes n'a pas été trouvé (ID: ${config.anecdoteChannelId})`);
        return;
      }

      // Accepter les canaux textuels ET les canaux d'annonces
      if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
        await LoggerService.error(`Le canal trouvé n'est pas un canal textuel ou d'annonces (Type: ${channel.type}, ID: ${config.anecdoteChannelId})`);
        return;
      }

      await LoggerService.info(`✅ Canal d'anecdotes trouvé: #${channel.name} (${channel instanceof NewsChannel ? 'Annonces' : 'Textuel'})`);

      // Récupérer une anecdote depuis le web
      const anecdote = await this.fetchAnecdoteFromWeb();

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return;
      }

      // Créer l'embed
      const embed = this.createAnecdoteEmbed(anecdote);

      // Envoyer le message avec mention du rôle
      await channel.send({
        content: "<@&1419413598718918758>",
        embeds: [embed]
      });
      await LoggerService.success(`Anecdote quotidienne envoyée : ${anecdote.title}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi de l'anecdote quotidienne: ${error}`);
    }
  }

  private static async fetchAnecdoteFromWeb(): Promise<Anecdote | null> {
    try {
      await LoggerService.info(`🤖 Tentative de génération d'anecdote via Gemini...`);

      // Essayer d'abord avec Gemini
      const geminiResult = await GeminiService.generateTechAnecdote();
      if (geminiResult) {
        await LoggerService.success(`Anecdote générée avec succès via Gemini`);

        // Ajouter "Généré par Gemini" comme première source
        const sources = [
          {
            name: "Généré par IA (Gemini)",
            url: "https://ai.google.dev/gemini-api"
          },
          ...geminiResult.sources // Ajouter les sources fournies par Gemini
        ];

        return {
          title: `🤖 ${geminiResult.title}`,
          paragraphs: geminiResult.paragraphs,
          sources
        };
      }

      // Fallback sur Wikipedia si Gemini échoue
      await LoggerService.warning(`Gemini non disponible, fallback sur Wikipedia...`);
      const anecdote = await this.fetchFromWikipedia();
      if (anecdote) {
        await LoggerService.success(`Anecdote récupérée avec succès depuis Wikipedia`);
        return anecdote;
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

      await LoggerService.info(`Tentative Wikipedia pour: ${randomTopic}`);

      // Utiliser Wikipedia FRANÇAIS avec un User-Agent valide
      const response = await axios.get(
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${randomTopic}`,
        {
          headers: {
            'User-Agent': 'Discord Bot Anecdotes/1.0 (https://github.com; contact@example.com)',
            'Api-User-Agent': 'Discord Bot Anecdotes/1.0'
          }
        }
      );

      await LoggerService.info(`Réponse Wikipedia reçue: ${response.status}`);

      if (!response.data || !response.data.extract) {
        await LoggerService.warning("Pas de données ou d'extrait dans la réponse Wikipedia");
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
            url: data.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${randomTopic}`,
          },
        ],
      };
    } catch (error) {
      // Erreur Wikipedia, retour null pour passer à la source suivante
      await LoggerService.error(`Erreur Wikipedia complète: ${error}`);
      return null;
    }
  }

  private static createAnecdoteEmbed(anecdote: Anecdote): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(anecdote.title)
      .setColor(0x5865F2) // Couleur bleu Discord
      .setTimestamp();

    // Ajouter le logo du bot dans le header
    if (bot.user) {
      embed.setAuthor({
        name: bot.user.username,
        iconURL: bot.user.displayAvatarURL()
      });
    }

    // Ajouter les paragraphes comme description
    const description = anecdote.paragraphs.join("\n\n");
    embed.setDescription(description);

    // Ajouter les sources dans le footer
    const sourcesText = anecdote.sources
      .map((source) => `${source.name}`)
      .join(" | ");
    embed.setFooter({ text: `Sources: ${sourcesText}` });

    // Ajouter les liens des sources comme champs si on veut les rendre cliquables
    if (anecdote.sources.length > 0) {
      const sourcesLinks = anecdote.sources
        .map((source) => `[${source.name}](${source.url})`)
        .join(" • ");
      embed.addFields({
        name: "🔗 Sources",
        value: sourcesLinks,
        inline: false
      });
    }

    return embed;
  }
}
