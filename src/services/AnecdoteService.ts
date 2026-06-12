import { TextChannel, EmbedBuilder, NewsChannel } from "discord.js";
import { bot } from "../index";
import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";
import { prisma } from "../lib/prisma";
import { GuildSettingsService, type Language } from "./GuildSettingsService";
import { TECH_TOPICS_BY_LANG } from "./techTopics";

interface Anecdote {
  title: string;
  paragraphs: string[];
  sources: { name: string; url: string }[];
  imageUrl?: string;
}

export class AnecdoteService {
  /**
   * Renvoie l'heure courante (0-23) dans un fuseau horaire donné.
   */
  public static getCurrentHourInTimezone(timezone: string): number {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    // "24" est renvoyé par certains environnements à minuit : on le ramène à 0.
    return parseInt(formatted, 10) % 24;
  }

  /**
   * Évalue, pour chaque serveur ayant des channels configurés, si l'heure
   * courante (dans son fuseau) fait partie de ses heures d'envoi, et envoie
   * une anecdote le cas échéant. Appelé par le cron horaire.
   */
  public static async sendScheduledAnecdotes(): Promise<void> {
    try {
      // Serveurs distincts ayant au moins un channel configuré
      const rows = await prisma.anecdoteChannel.findMany({
        distinct: ["guildId"],
        select: { guildId: true },
      });

      if (rows.length === 0) {
        return;
      }

      for (const { guildId } of rows) {
        try {
          const settings = await GuildSettingsService.get(guildId);
          const currentHour = this.getCurrentHourInTimezone(settings.timezone);

          if (!settings.hours.includes(currentHour)) {
            continue;
          }

          await LoggerService.info(`🕐 Envoi programmé pour le serveur ${guildId} (${currentHour}h ${settings.timezone})`);
          await this.sendAnecdotesToGuild(guildId);
        } catch (error) {
          await LoggerService.error(`Erreur lors de l'envoi programmé au serveur ${guildId}: ${error}`);
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'évaluation des envois programmés: ${error}`);
    }
  }

  /**
   * Envoie une anecdote à tous les channels configurés d'un serveur spécifique
   */
  public static async sendAnecdotesToGuild(guildId: string): Promise<string[]> {
    try {
      const anecdoteChannels = await prisma.anecdoteChannel.findMany({
        where: { guildId }
      });

      if (anecdoteChannels.length === 0) {
        await LoggerService.warning(`Aucun channel d'anecdotes configuré pour le serveur ${guildId}`);
        return [];
      }

      const language = await GuildSettingsService.getLanguage(guildId);
      const anecdote = await this.fetchAnecdoteFromWeb(guildId, language);

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return [];
      }

      await this.saveAnecdoteTitle(anecdote.title, guildId);
      const embed = this.createAnecdoteEmbed(anecdote);

      await Promise.allSettled(anecdoteChannels.map(async (channelConfig) => {
        try {
          const channel = await bot.channels.fetch(channelConfig.channelId);

          if (!channel) {
            await LoggerService.warning(`Channel ${channelConfig.channelId} introuvable`);
            return;
          }

          if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
            return;
          }

          const content = channelConfig.roleId ? `<@&${channelConfig.roleId}>` : undefined;
          await channel.send({ content, embeds: [embed] });
          await LoggerService.success(`Anecdote envoyée à #${channel.name}`);
        } catch (error) {
          await LoggerService.error(`Erreur lors de l'envoi au channel ${channelConfig.channelId}: ${error}`);
        }
      }));

      return anecdoteChannels.map((c) => c.channelId);
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi des anecdotes au serveur ${guildId}: ${error}`);
      return [];
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

      const language = await GuildSettingsService.getLanguage(guildId);
      const anecdote = await this.fetchAnecdoteFromWeb(guildId, language);

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

  /** Libellé de la source "généré par IA" selon la langue du serveur. */
  private static readonly AI_SOURCE_NAME: Record<Language, string> = {
    fr: "Généré par IA (Gemini)",
    en: "AI-generated (Gemini)",
    es: "Generado por IA (Gemini)",
    de: "KI-generiert (Gemini)",
    it: "Generato da IA (Gemini)",
  };

  private static async fetchAnecdoteFromWeb(guildId: string, language: Language): Promise<Anecdote | null> {
    try {
      await LoggerService.info(`🤖 Tentative de génération d'anecdote via Gemini (${language})...`);

      // Essayer d'abord avec Gemini (filtre les anecdotes déjà envoyées sur ce serveur)
      const geminiResult = await GeminiService.generateTechAnecdote(guildId, language);

      if (geminiResult) {
        await LoggerService.success(`Anecdote générée avec succès via Gemini`);

        // Ajouter "Généré par Gemini" comme première source
        const sources = [
          {
            name: this.AI_SOURCE_NAME[language],
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
      await LoggerService.warning(`Gemini non disponible, fallback sur Wikipedia (${language})...`);
      const anecdote = await this.fetchFromWikipedia(language);
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

  private static async fetchFromWikipedia(language: Language): Promise<Anecdote | null> {
    const topics = TECH_TOPICS_BY_LANG[language];
    // Plusieurs tentatives sur des sujets aléatoires différents : certains
    // titres peuvent ne pas exister dans une édition donnée (404).
    const MAX_ATTEMPTS = 3;
    const tried = new Set<string>();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let randomTopic = topics[Math.floor(Math.random() * topics.length)];
      // Éviter de retenter le même sujet
      let guard = 0;
      while (tried.has(randomTopic) && guard++ < topics.length) {
        randomTopic = topics[Math.floor(Math.random() * topics.length)];
      }
      tried.add(randomTopic);

      const result = await this.fetchWikipediaTopic(language, randomTopic);
      if (result) {
        return result;
      }
    }

    return null;
  }

  private static async fetchWikipediaTopic(language: Language, topic: string): Promise<Anecdote | null> {
    try {
      await LoggerService.info(`Tentative Wikipedia (${language}) pour: ${topic}`);

      // Utiliser l'édition Wikipedia de la langue du serveur avec un User-Agent valide
      const response = await axios.get(
        `https://${language}.wikipedia.org/api/rest_v1/page/summary/${topic}`,
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
            url: data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${topic}`,
          },
        ],
      };
    } catch (error) {
      // Erreur Wikipedia, retour null pour passer à la source suivante
      await LoggerService.error(`Erreur Wikipedia complète: ${error}`);
      return null;
    }
  }

  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private static createAnecdoteEmbed(anecdote: Anecdote): EmbedBuilder {
    // Limites Discord : title 256, description 4096, footer 2048, field value 1024
    const title = anecdote.title.slice(0, 256);
    const description = anecdote.paragraphs.join("\n\n").slice(0, 4096);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x5865F2)
      .setTimestamp()
      .setDescription(description);

    if (bot.user) {
      embed.setAuthor({
        name: bot.user.username,
        iconURL: bot.user.displayAvatarURL()
      });
    }

    // Filtrer les sources avec URLs valides (http/https uniquement)
    const safeSources = anecdote.sources.filter(
      (s) => s.name && s.url && this.isValidUrl(s.url)
    );

    if (safeSources.length > 0) {
      const footerText = `Sources: ${safeSources.map((s) => s.name).join(" | ")}`.slice(0, 2048);
      embed.setFooter({ text: footerText });

      const sourcesLinks = safeSources
        .map((s) => `[${s.name}](${s.url})`)
        .join(" • ")
        .slice(0, 1024);
      embed.addFields({ name: "🔗 Sources", value: sourcesLinks, inline: false });
    }

    return embed;
  }
}
