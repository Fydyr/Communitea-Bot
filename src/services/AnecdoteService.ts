import { TextChannel, EmbedBuilder, NewsChannel, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { bot } from "../index";
import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";
import { prisma } from "../lib/prisma";
import { GuildSettingsService, type Language, type Theme } from "./GuildSettingsService";
import { TECH_TOPICS_BY_LANG } from "./techTopics";
import { t, themeLabel } from "../i18n";

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
   * Renvoie le jour de la semaine (0 = dimanche … 6 = samedi) dans un fuseau.
   */
  public static getCurrentWeekdayInTimezone(timezone: string): number {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date());
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days.indexOf(weekday.toLowerCase());
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
   * Récap hebdomadaire : chaque dimanche à 20h (heure du serveur), poste
   * l'anecdote la plus appréciée des 7 derniers jours dans les salons du serveur.
   * Appelé par le cron horaire.
   */
  public static async sendWeeklyRecaps(): Promise<void> {
    try {
      const rows = await prisma.anecdoteChannel.findMany({
        distinct: ["guildId"],
        select: { guildId: true },
      });

      for (const { guildId } of rows) {
        try {
          const settings = await GuildSettingsService.get(guildId);
          const hour = this.getCurrentHourInTimezone(settings.timezone);
          const weekday = this.getCurrentWeekdayInTimezone(settings.timezone);

          // Dimanche (0) à 20h
          if (weekday !== 0 || hour !== 20) {
            continue;
          }

          const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const candidates = await prisma.anecdoteMessage.findMany({
            where: { guildId, sentAt: { gte: since } },
          });

          if (candidates.length === 0) {
            continue;
          }

          const top = candidates.reduce((best, current) =>
            current.upvotes - current.downvotes > best.upvotes - best.downvotes ? current : best
          );

          if (top.upvotes === 0) {
            continue;
          }

          const url = `https://discord.com/channels/${guildId}/${top.channelId}/${top.messageId}`;
          const embed = new EmbedBuilder()
            .setTitle(t(settings.language, "recap.title"))
            .setColor(0xFFD700)
            .setDescription(
              t(settings.language, "recap.description", {
                up: top.upvotes,
                down: top.downvotes,
                title: top.title,
                url,
              })
            )
            .setTimestamp();

          const channels = await prisma.anecdoteChannel.findMany({ where: { guildId } });
          for (const channelConfig of channels) {
            try {
              const channel = await bot.channels.fetch(channelConfig.channelId);
              if (channel instanceof TextChannel || channel instanceof NewsChannel) {
                await channel.send({ embeds: [embed] });
              }
            } catch (error) {
              await LoggerService.error(`Erreur récap au salon ${channelConfig.channelId}: ${error}`);
            }
          }
          await LoggerService.success(`Récap hebdo envoyé au serveur ${guildId}`);
        } catch (error) {
          await LoggerService.error(`Erreur lors du récap hebdo du serveur ${guildId}: ${error}`);
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'évaluation des récaps hebdo: ${error}`);
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

      const settings = await GuildSettingsService.get(guildId);
      const anecdote = await this.fetchAnecdoteFromWeb(guildId, settings.language, this.buildThemesContext(settings.themes));

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
          const sent = await channel.send({ content, embeds: [embed], components: this.voteComponents() });
          await this.trackSentMessage(sent, guildId, anecdote.title, settings.language);
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

      const settings = await GuildSettingsService.get(guildId);
      const anecdote = await this.fetchAnecdoteFromWeb(guildId, settings.language, this.buildThemesContext(settings.themes));

      if (!anecdote) {
        await LoggerService.error("Impossible de récupérer une anecdote depuis le web");
        return false;
      }

      // Sauvegarder le titre de l'anecdote pour ce serveur
      await this.saveAnecdoteTitle(anecdote.title, guildId);

      const embed = this.createAnecdoteEmbed(anecdote);
      const content = roleId ? `<@&${roleId}>` : undefined;

      const sent = await channel.send({
        content,
        embeds: [embed],
        components: this.voteComponents()
      });
      await this.trackSentMessage(sent, guildId, anecdote.title, settings.language);

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

  /**
   * Page d'historique des anecdotes envoyées sur un serveur (la plus récente
   * en premier), avec compteurs de votes.
   */
  public static async getHistoryPage(guildId: string, page: number, pageSize = 5): Promise<{
    items: { title: string; sentAt: Date; upvotes: number; downvotes: number }[];
    total: number;
    pages: number;
    page: number;
  }> {
    const total = await prisma.anecdoteMessage.count({ where: { guildId } });
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(0, page), pages - 1);

    const items = await prisma.anecdoteMessage.findMany({
      where: { guildId },
      orderBy: { sentAt: "desc" },
      skip: current * pageSize,
      take: pageSize,
      select: { title: true, sentAt: true, upvotes: true, downvotes: true },
    });

    return { items, total, pages, page: current };
  }

  /**
   * Construit l'embed d'une anecdote sur un sujet imposé (commande à la demande).
   */
  public static async buildAboutEmbed(topic: string, language: Language): Promise<{ embed: EmbedBuilder; title: string } | null> {
    const result = await GeminiService.generateAnecdoteAbout(topic, language);
    if (!result) {
      return null;
    }

    const anecdote: Anecdote = {
      title: `🤖 ${result.title}`,
      paragraphs: result.paragraphs,
      sources: [
        { name: this.AI_SOURCE_NAME[language], url: "https://ai.google.dev/gemini-api" },
        ...result.sources,
      ],
    };

    return { embed: this.createAnecdoteEmbed(anecdote), title: anecdote.title };
  }

  /** Identifiants des boutons de vote (statiques : le message ciblé est déduit du clic). */
  public static readonly VOTE_UP_ID = "vote:up";
  public static readonly VOTE_DOWN_ID = "vote:down";

  /** Construit la rangée de boutons de vote 👍 / 👎 avec leurs compteurs. */
  public static voteComponents(upvotes = 0, downvotes = 0): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(this.VOTE_UP_ID)
        .setEmoji("👍")
        .setLabel(String(upvotes))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(this.VOTE_DOWN_ID)
        .setEmoji("👎")
        .setLabel(String(downvotes))
        .setStyle(ButtonStyle.Danger)
    );
    return [row];
  }

  /**
   * Enregistre un message d'anecdote envoyé (pour l'historique et les votes).
   * Les boutons de vote sont attachés à l'envoi par les appelants.
   */
  public static async trackSentMessage(message: Message, guildId: string, title: string, language: Language): Promise<void> {
    try {
      const cleanTitle = title.replace(/^[^\w\s]+\s*/, "").trim();
      await prisma.anecdoteMessage.create({
        data: {
          guildId,
          channelId: message.channelId,
          messageId: message.id,
          title: cleanTitle,
          language,
        },
      });
    } catch (error) {
      await LoggerService.error(`Erreur lors du suivi de l'anecdote (${message.id}): ${error}`);
    }
  }

  /**
   * Applique le vote d'un utilisateur (👍 = 1, 👎 = -1) sur une anecdote suivie,
   * avec bascule si l'utilisateur reclique le même vote. Renvoie les compteurs
   * à jour, ou null si le message n'est pas une anecdote suivie.
   */
  public static async applyVote(messageId: string, userId: string, value: 1 | -1): Promise<{ upvotes: number; downvotes: number } | null> {
    const tracked = await prisma.anecdoteMessage.findUnique({ where: { messageId } });
    if (!tracked) {
      return null;
    }

    const existing = await prisma.anecdoteVote.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (!existing) {
      await prisma.anecdoteVote.create({ data: { messageId, userId, value } });
    } else if (existing.value === value) {
      await prisma.anecdoteVote.delete({ where: { id: existing.id } });
    } else {
      await prisma.anecdoteVote.update({ where: { id: existing.id }, data: { value } });
    }

    const upvotes = await prisma.anecdoteVote.count({ where: { messageId, value: 1 } });
    const downvotes = await prisma.anecdoteVote.count({ where: { messageId, value: -1 } });

    await prisma.anecdoteMessage.update({
      where: { messageId },
      data: { upvotes, downvotes },
    });

    return { upvotes, downvotes };
  }

  /** Libellé de la source "généré par IA" selon la langue du serveur. */
  private static readonly AI_SOURCE_NAME: Record<Language, string> = {
    fr: "Généré par IA (Gemini)",
    en: "AI-generated (Gemini)",
    es: "Generado por IA (Gemini)",
    de: "KI-generiert (Gemini)",
    it: "Generato da IA (Gemini)",
  };

  /** Construit la directive de thèmes pour le prompt Gemini (libellés en français). */
  public static buildThemesContext(themes: Theme[]): string {
    if (themes.length === 0) {
      return "";
    }
    const labels = themes.map((theme) => themeLabel("fr", theme)).join(", ");
    return `\n\nTHÈMES IMPOSÉS : concentre-toi exclusivement sur ces thèmes : ${labels}.`;
  }

  private static async fetchAnecdoteFromWeb(guildId: string, language: Language, themesContext = ""): Promise<Anecdote | null> {
    try {
      await LoggerService.info(`🤖 Tentative de génération d'anecdote via Gemini (${language})...`);

      // Essayer d'abord avec Gemini (filtre les anecdotes déjà envoyées sur ce serveur)
      const geminiResult = await GeminiService.generateTechAnecdote(guildId, language, themesContext);

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
