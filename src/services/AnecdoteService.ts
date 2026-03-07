import { TextChannel, EmbedBuilder, NewsChannel } from "discord.js";
import { bot } from "../index";
import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";
import { prisma } from "../lib/prisma";

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

  /**
   * Envoie les anecdotes quotidiennes à tous les channels configurés
   * Génère une anecdote différente par serveur
   */
  public static async sendDailyAnecdotes(): Promise<void> {
    try {
      // Récupérer tous les channels configurés
      const anecdoteChannels = await prisma.anecdoteChannel.findMany();

      if (anecdoteChannels.length === 0) {
        await LoggerService.warning("Aucun channel d'anecdotes configuré");
        return;
      }

      // Regrouper les channels par serveur
      const channelsByGuild = new Map<string, typeof anecdoteChannels>();
      for (const channel of anecdoteChannels) {
        const guildChannels = channelsByGuild.get(channel.guildId) || [];
        guildChannels.push(channel);
        channelsByGuild.set(channel.guildId, guildChannels);
      }

      await LoggerService.info(`📤 Envoi des anecdotes à ${channelsByGuild.size} serveur(s)...`);

      // Générer et envoyer une anecdote différente par serveur
      for (const [guildId, channels] of channelsByGuild) {
        try {
          const anecdote = await this.fetchAnecdoteFromWeb(guildId);

          if (!anecdote) {
            await LoggerService.error(`Impossible de récupérer une anecdote pour le serveur ${guildId}`);
            continue;
          }

          // Sauvegarder le titre de l'anecdote pour ce serveur
          await this.saveAnecdoteTitle(anecdote.title, guildId);

          // Créer l'embed
          const embed = this.createAnecdoteEmbed(anecdote);

          // Envoyer à chaque channel du serveur
          for (const channelConfig of channels) {
            try {
              const channel = await bot.channels.fetch(channelConfig.channelId);

              if (!channel) {
                await LoggerService.warning(`Channel ${channelConfig.channelId} introuvable, suppression de la config...`);
                await prisma.anecdoteChannel.delete({ where: { id: channelConfig.id } });
                continue;
              }

              if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
                await LoggerService.warning(`Channel ${channelConfig.channelId} n'est pas un canal textuel ou d'annonces`);
                continue;
              }

              const content = channelConfig.roleId ? `<@&${channelConfig.roleId}>` : undefined;

              await channel.send({
                content,
                embeds: [embed]
              });

              await LoggerService.success(`Anecdote envoyée à #${channel.name} (${guildId})`);
            } catch (error) {
              await LoggerService.error(`Erreur lors de l'envoi au channel ${channelConfig.channelId}: ${error}`);
            }
          }

          await LoggerService.success(`Anecdote quotidienne envoyée au serveur ${guildId}: ${anecdote.title}`);
        } catch (error) {
          await LoggerService.error(`Erreur lors de l'envoi des anecdotes au serveur ${guildId}: ${error}`);
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi des anecdotes quotidiennes: ${error}`);
    }
  }

  /**
   * Envoie une anecdote à tous les channels configurés d'un serveur spécifique
   */
  public static async sendAnecdotesToGuild(guildId: string): Promise<void> {
    try {
      const anecdoteChannels = await prisma.anecdoteChannel.findMany({
        where: { guildId }
      });

      if (anecdoteChannels.length === 0) {
        await LoggerService.warning(`Aucun channel d'anecdotes configuré pour le serveur ${guildId}`);
        return;
      }

      const anecdote = await this.fetchAnecdoteFromWeb(guildId);

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return;
      }

      await this.saveAnecdoteTitle(anecdote.title, guildId);
      const embed = this.createAnecdoteEmbed(anecdote);

      for (const channelConfig of anecdoteChannels) {
        try {
          const channel = await bot.channels.fetch(channelConfig.channelId);

          if (!channel) {
            await LoggerService.warning(`Channel ${channelConfig.channelId} introuvable`);
            continue;
          }

          if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
            continue;
          }

          const content = channelConfig.roleId ? `<@&${channelConfig.roleId}>` : undefined;

          await channel.send({
            content,
            embeds: [embed]
          });

          await LoggerService.success(`Anecdote envoyée à #${channel.name}`);
        } catch (error) {
          await LoggerService.error(`Erreur lors de l'envoi au channel ${channelConfig.channelId}: ${error}`);
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi des anecdotes au serveur ${guildId}: ${error}`);
    }
  }

  /**
   * Envoie une anecdote à un channel spécifique (pour la commande manuelle)
   */
  public static async sendAnecdoteToChannel(channelId: string, guildId: string, roleId?: string | null): Promise<boolean> {
    try {
      const channel = await bot.channels.fetch(channelId);

      if (!channel) {
        await LoggerService.error(`Channel ${channelId} introuvable`);
        return false;
      }

      if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
        await LoggerService.error(`Channel ${channelId} n'est pas un canal textuel ou d'annonces`);
        return false;
      }

      const anecdote = await this.fetchAnecdoteFromWeb(guildId);

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return false;
      }

      // Sauvegarder le titre de l'anecdote pour ce serveur
      await this.saveAnecdoteTitle(anecdote.title, guildId);

      const embed = this.createAnecdoteEmbed(anecdote);
      const content = roleId ? `<@&${roleId}>` : undefined;

      await channel.send({
        content,
        embeds: [embed]
      });

      await LoggerService.success(`Anecdote envoyée manuellement à #${channel.name}`);
      return true;
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi de l'anecdote: ${error}`);
      return false;
    }
  }

  /**
   * Sauvegarde le titre d'une anecdote envoyée pour un serveur spécifique
   */
  private static async saveAnecdoteTitle(title: string, guildId: string): Promise<void> {
    // Nettoyer le titre (enlever les emojis au début)
    const cleanTitle = title.replace(/^[^\w\s]+\s*/, "").trim();

    await prisma.sentAnecdote.create({
      data: { title: cleanTitle, guildId }
    });

    await LoggerService.info(`📝 Titre sauvegardé pour le serveur ${guildId}: ${cleanTitle}`);
  }

  /**
   * Récupère le nombre d'anecdotes déjà envoyées
   */
  public static async getSentAnecdotesCount(): Promise<number> {
    return prisma.sentAnecdote.count();
  }

  private static async fetchAnecdoteFromWeb(guildId?: string): Promise<Anecdote | null> {
    try {
      await LoggerService.info(`🤖 Tentative de génération d'anecdote via Gemini...`);

      // Essayer d'abord avec Gemini (si guildId fourni, filtrera les anecdotes déjà envoyées)
      const geminiResult = guildId
        ? await GeminiService.generateTechAnecdote(guildId)
        : null;

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
