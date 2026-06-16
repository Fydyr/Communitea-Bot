import { Discord, Slash, SlashOption, SlashChoice, ButtonComponent } from "discordx";
import {
  CommandInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  NewsChannel,
  Role,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType
} from "discord.js";
import { AnecdoteService } from "../services/AnecdoteService";
import { QuizService } from "../services/QuizService";
import { LevelService } from "../services/LevelService";
import { LoggerService } from "../services/LoggerService";
import {
  GuildSettingsService,
  DEFAULT_LANGUAGE,
  type Language,
  type Theme
} from "../services/GuildSettingsService";
import { t, LANGUAGE_LABELS, themeLabel } from "../i18n";
import { prisma } from "../lib/prisma";
import { config } from "../config";

/** Récupère la langue d'un serveur (ou le français par défaut hors serveur). */
async function langOf(guildId: string | null): Promise<Language> {
  return guildId ? GuildSettingsService.getLanguage(guildId) : DEFAULT_LANGUAGE;
}

/**
 * Options rendant une commande utilisable en tant qu'application installée sur
 * un compte utilisateur (MP et n'importe quel serveur), en plus de l'install serveur.
 */
const USER_APP = {
  integrationTypes: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
  contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
};

/** Formate une liste d'heures pour l'affichage selon la langue. */
function formatHours(hours: number[], lang: Language, emptyLabel?: string): string {
  if (hours.length === 0) {
    return emptyLabel ?? t(lang, "schedule.noHours");
  }
  const fmt = lang === "fr" ? (h: number) => `${h}h` : (h: number) => `${h}:00`;
  return hours.map(fmt).join(", ");
}

/** Formate la liste des thèmes pour l'affichage (ou "Tous" si vide). */
function formatThemes(themes: Theme[], lang: Language): string {
  if (themes.length === 0) {
    return t(lang, "schedule.allThemes");
  }
  return themes.map((theme) => themeLabel(lang, theme)).join(", ");
}

interface HistoryPage {
  items: { title: string; sentAt: Date; upvotes: number; downvotes: number }[];
  total: number;
  pages: number;
  page: number;
}

/** Construit l'embed + boutons de pagination de l'historique. */
function buildHistoryView(data: HistoryPage, lang: Language): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setTitle(t(lang, "history.title"))
    .setColor(0x5865F2)
    .setTimestamp();

  if (data.total === 0) {
    embed.setDescription(t(lang, "history.empty"));
    return { embeds: [embed], components: [] };
  }

  const lines = data.items.map((item) => {
    const ts = Math.floor(item.sentAt.getTime() / 1000);
    return `**${item.title}**\n<t:${ts}:f> · 👍 ${item.upvotes} · 👎 ${item.downvotes}`;
  });
  embed
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: t(lang, "history.footer", { page: data.page + 1, pages: data.pages, total: data.total }) });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hist:prev:${data.page - 1}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page <= 0),
    new ButtonBuilder()
      .setCustomId(`hist:next:${data.page + 1}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page >= data.pages - 1)
  );

  return { embeds: [embed], components: [row] };
}

@Discord()
export class AnecdoteController {
  @Slash({
    name: "setup",
    description: "Configure le channel pour recevoir les anecdotes quotidiennes",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async setupAnecdote(
    @SlashOption({
      name: "channel",
      description: "Le channel où envoyer les anecdotes",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
    })
    channel: TextChannel | NewsChannel,
    @SlashOption({
      name: "role",
      description: "Le rôle à mentionner lors de l'envoi (optionnel)",
      required: false,
      type: ApplicationCommandOptionType.Role
    })
    role: Role | null,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const roleSuffix = role ? t(lang, "setup.roleSuffix", { role: role.id }) : "";

      const existing = await prisma.anecdoteChannel.findUnique({
        where: {
          guildId_channelId: {
            guildId: interaction.guildId,
            channelId: channel.id
          }
        }
      });

      if (existing) {
        await prisma.anecdoteChannel.update({
          where: { id: existing.id },
          data: { roleId: role?.id || null }
        });
        await interaction.editReply(t(lang, "setup.updated", { channel: channel.id, roleSuffix }));
      } else {
        await prisma.anecdoteChannel.create({
          data: {
            guildId: interaction.guildId,
            channelId: channel.id,
            roleId: role?.id || null
          }
        });
        await interaction.editReply(t(lang, "setup.created", { channel: channel.id, roleSuffix }));
      }

      await LoggerService.success(`Anecdote channel configuré: ${channel.name} (${interaction.guildId})`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la configuration du channel d'anecdotes: ${error}`);
      await interaction.editReply(t(lang, "setup.error"));
    }
  }

  @Slash({
    name: "remove",
    description: "Retire la configuration d'anecdotes pour un channel",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async removeAnecdote(
    @SlashOption({
      name: "channel",
      description: "Le channel à retirer de la configuration",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
    })
    channel: TextChannel | NewsChannel,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const deleted = await prisma.anecdoteChannel.deleteMany({
        where: {
          guildId: interaction.guildId,
          channelId: channel.id
        }
      });

      if (deleted.count > 0) {
        await interaction.editReply(t(lang, "remove.success", { channel: channel.id }));
        await LoggerService.info(`Anecdote channel retiré: ${channel.name} (${interaction.guildId})`);
      } else {
        await interaction.editReply(t(lang, "remove.notConfigured", { channel: channel.id }));
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de la suppression du channel d'anecdotes: ${error}`);
      await interaction.editReply(t(lang, "remove.error"));
    }
  }

  @Slash({
    name: "list",
    description: "Liste les channels configurés pour les anecdotes sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async listAnecdotes(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const channels = await prisma.anecdoteChannel.findMany({
        where: { guildId: interaction.guildId }
      });

      if (channels.length === 0) {
        await interaction.editReply(t(lang, "list.empty"));
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "list.title"))
        .setColor(0x5865F2)
        .setDescription(
          channels.map((c: { channelId: string; roleId: string | null }) =>
            `• <#${c.channelId}>${c.roleId ? ` → <@&${c.roleId}>` : ""}`
          ).join("\n")
        )
        .setFooter({ text: t(lang, "list.footer", { count: channels.length }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors de la liste des channels d'anecdotes: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "send-anecdote",
    description: "Envoie immédiatement une anecdote dans les channels configurés du serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async sendAnecdote(interaction: CommandInteraction): Promise<void> {
    const lang = await langOf(interaction.guildId);

    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: t(lang, "send.noPermission"), flags: 64 });
      return;
    }

    await interaction.deferReply({ flags: 64 });

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const sentChannelIds = await AnecdoteService.sendAnecdotesToGuild(interaction.guildId);

      if (sentChannelIds.length === 0) {
        await interaction.editReply(t(lang, "send.noChannel"));
        return;
      }

      const channelMentions = sentChannelIds.map((id) => `<#${id}>`).join(", ");
      await interaction.editReply(t(lang, "send.success", { channels: channelMentions }));
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi manuel de l'anecdote: ${error}`);
      await interaction.editReply(t(lang, "send.error"));
    }
  }

  @Slash({
    name: "stats",
    description: "Affiche les statistiques des anecdotes",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async anecdoteStats(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      const totalChannels = await prisma.anecdoteChannel.count();
      const guildChannels = interaction.guildId
        ? await prisma.anecdoteChannel.count({ where: { guildId: interaction.guildId } })
        : 0;
      const totalAnecdotes = await AnecdoteService.getSentAnecdotesCount();

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "stats.title"))
        .setColor(0x5865F2)
        .addFields(
          { name: t(lang, "stats.sent"), value: `${totalAnecdotes}`, inline: true },
          { name: t(lang, "stats.channelsGlobal"), value: `${totalChannels}`, inline: true },
          { name: t(lang, "stats.channelsGuild"), value: `${guildChannels}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'affichage des stats: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "anecdote-about",
    description: "Génère une anecdote sur un sujet précis",
    ...USER_APP
  })
  async anecdoteAbout(
    @SlashOption({
      name: "sujet",
      description: "Le sujet de l'anecdote (ex: Linux, Ada Lovelace, le bug de l'an 2000)",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    topic: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();
    const lang = await langOf(interaction.guildId);

    try {
      const result = await AnecdoteService.buildAboutEmbed(topic, lang);
      if (!result) {
        await interaction.editReply(t(lang, "about.failed"));
        return;
      }

      const components = interaction.guildId ? AnecdoteService.voteComponents() : [];
      await interaction.editReply({ embeds: [result.embed], components });

      if (interaction.guildId) {
        const message = await interaction.fetchReply();
        await AnecdoteService.trackSentMessage(message, interaction.guildId, result.title, lang);
      }
    } catch (error) {
      await LoggerService.error(`Erreur /anecdote-about: ${error}`);
      await interaction.editReply(t(lang, "about.failed"));
    }
  }

  @Slash({
    name: "hour-add",
    description: "Ajoute une heure d'envoi quotidien des anecdotes (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async addHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à laquelle envoyer les anecdotes",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23
    })
    hour: number,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.addHour(interaction.guildId, hour);

      switch (result.status) {
        case "invalid":
          await interaction.editReply(t(lang, "hourAdd.invalid"));
          return;
        case "exists":
          await interaction.editReply(t(lang, "hourAdd.exists", { hour }));
          return;
        case "added":
          await interaction.editReply(t(lang, "hourAdd.added", { hour, hours: formatHours(result.hours, lang) }));
          await LoggerService.info(`Heure d'envoi ajoutée (${hour}h) pour le serveur ${interaction.guildId}`);
          return;
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'ajout d'une heure d'envoi: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "hour-remove",
    description: "Retire une heure d'envoi quotidien des anecdotes (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async removeHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à retirer",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23
    })
    hour: number,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.removeHour(interaction.guildId, hour);

      if (result.status === "not-present") {
        await interaction.editReply(t(lang, "hourRemove.notPresent", { hour }));
        return;
      }

      if (result.emptied) {
        await interaction.editReply(t(lang, "hourRemove.emptied", { hour }));
      } else {
        await interaction.editReply(t(lang, "hourRemove.removed", { hour, hours: formatHours(result.hours, lang) }));
      }
      await LoggerService.info(`Heure d'envoi retirée (${hour}h) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors du retrait d'une heure d'envoi: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "schedule",
    description: "Affiche l'horaire des anecdotes (heures, fuseau, langue) de ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async showSchedule(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const settings = await GuildSettingsService.get(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "schedule.title"))
        .setColor(0x5865F2)
        .addFields(
          { name: t(lang, "schedule.hours"), value: formatHours(settings.hours, settings.language), inline: true },
          { name: t(lang, "schedule.timezone"), value: `\`${settings.timezone}\``, inline: true },
          { name: t(lang, "schedule.language"), value: LANGUAGE_LABELS[settings.language], inline: true },
          { name: t(lang, "schedule.themes"), value: formatThemes(settings.themes, settings.language), inline: true },
          { name: t(lang, "schedule.quizHours"), value: formatHours(settings.quizHours, settings.language, "-"), inline: true }
        )
        .setTimestamp();

      if (settings.isDefault) {
        embed.setDescription(t(lang, "schedule.defaultNote"));
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'affichage de l'horaire: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "timezone",
    description: "Définit le fuseau horaire utilisé pour les heures d'envoi (ex: Europe/Paris)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async setTimezone(
    @SlashOption({
      name: "timezone",
      description: "Identifiant de fuseau IANA, ex: Europe/Paris, America/New_York",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    timezone: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      if (!GuildSettingsService.isValidTimezone(timezone)) {
        await interaction.editReply(t(lang, "timezone.invalid"));
        return;
      }

      await GuildSettingsService.setTimezone(interaction.guildId, timezone);
      await interaction.editReply(t(lang, "timezone.success", { timezone }));
      await LoggerService.info(`Fuseau horaire défini (${timezone}) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la définition du fuseau horaire: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "language",
    description: "Définit la langue des anecdotes et des messages du bot pour ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async setLanguage(
    @SlashChoice({ name: "Français", value: "fr" })
    @SlashChoice({ name: "English", value: "en" })
    @SlashChoice({ name: "Español", value: "es" })
    @SlashChoice({ name: "Deutsch", value: "de" })
    @SlashChoice({ name: "Italiano", value: "it" })
    @SlashOption({
      name: "code",
      description: "La langue à utiliser",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    code: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(await langOf(null), "common.notInGuild"));
        return;
      }

      if (!GuildSettingsService.isValidLanguage(code)) {
        await interaction.editReply(t(await langOf(interaction.guildId), "common.error"));
        return;
      }

      await GuildSettingsService.setLanguage(interaction.guildId, code);
      // Confirmer dans la nouvelle langue choisie
      await interaction.editReply(t(code, "language.success", { language: LANGUAGE_LABELS[code] }));
      await LoggerService.info(`Langue définie (${code}) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la définition de la langue: ${error}`);
      await interaction.editReply(t(DEFAULT_LANGUAGE, "common.error"));
    }
  }

  @Slash({
    name: "theme-add",
    description: "Ajoute un thème aux anecdotes générées sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async addTheme(
    @SlashChoice({ name: "Langages de programmation", value: "langages" })
    @SlashChoice({ name: "Entreprises tech", value: "entreprises" })
    @SlashChoice({ name: "Personnalités tech", value: "personnalites" })
    @SlashChoice({ name: "Jeux vidéo", value: "jeux-video" })
    @SlashChoice({ name: "Cybersécurité", value: "securite" })
    @SlashChoice({ name: "Matériel informatique", value: "hardware" })
    @SlashChoice({ name: "Web et internet", value: "web" })
    @SlashChoice({ name: "Intelligence artificielle", value: "ia" })
    @SlashChoice({ name: "Histoire de l'informatique", value: "histoire" })
    @SlashOption({
      name: "theme",
      description: "Le thème à ajouter",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    theme: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.addTheme(interaction.guildId, theme);

      switch (result.status) {
        case "invalid":
          await interaction.editReply(t(lang, "themeAdd.invalid"));
          return;
        case "exists":
          await interaction.editReply(t(lang, "themeAdd.exists", { theme: themeLabel(lang, theme as Theme) }));
          return;
        case "added":
          await interaction.editReply(t(lang, "themeAdd.added", {
            theme: themeLabel(lang, theme as Theme),
            themes: formatThemes(result.themes, lang)
          }));
          await LoggerService.info(`Thème ajouté (${theme}) pour le serveur ${interaction.guildId}`);
          return;
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'ajout d'un thème: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "theme-remove",
    description: "Retire un thème des anecdotes générées sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async removeTheme(
    @SlashChoice({ name: "Langages de programmation", value: "langages" })
    @SlashChoice({ name: "Entreprises tech", value: "entreprises" })
    @SlashChoice({ name: "Personnalités tech", value: "personnalites" })
    @SlashChoice({ name: "Jeux vidéo", value: "jeux-video" })
    @SlashChoice({ name: "Cybersécurité", value: "securite" })
    @SlashChoice({ name: "Matériel informatique", value: "hardware" })
    @SlashChoice({ name: "Web et internet", value: "web" })
    @SlashChoice({ name: "Intelligence artificielle", value: "ia" })
    @SlashChoice({ name: "Histoire de l'informatique", value: "histoire" })
    @SlashOption({
      name: "theme",
      description: "Le thème à retirer",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    theme: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.removeTheme(interaction.guildId, theme);

      if (result.status === "not-present") {
        await interaction.editReply(t(lang, "themeRemove.notPresent", { theme: themeLabel(lang, theme as Theme) }));
        return;
      }

      await interaction.editReply(t(lang, "themeRemove.removed", {
        theme: themeLabel(lang, theme as Theme),
        themes: formatThemes(result.themes, lang)
      }));
      await LoggerService.info(`Thème retiré (${theme}) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors du retrait d'un thème: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "quiz",
    description: "Lance un quiz tech interactif",
    ...USER_APP
  })
  async quiz(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();
    const lang = await langOf(interaction.guildId);

    try {
      const generated = interaction.guildId
        ? await QuizService.generateForGuild(interaction.guildId)
        : await QuizService.generate(DEFAULT_LANGUAGE);
      if (!generated) {
        await interaction.editReply(t(lang, "quiz.failed"));
        return;
      }

      const { embeds, components } = QuizService.buildMessage(generated.quiz, generated.lang);
      await interaction.editReply({ embeds, components });

      const message = await interaction.fetchReply();
      QuizService.attachCollector(message, generated.quiz, generated.lang);
    } catch (error) {
      await LoggerService.error(`Erreur /quiz: ${error}`);
      await interaction.editReply(t(lang, "quiz.failed"));
    }
  }

  @Slash({
    name: "quiz-hour-add",
    description: "Ajoute une heure d'envoi automatique de quiz (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async addQuizHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à laquelle envoyer un quiz",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23
    })
    hour: number,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.addQuizHour(interaction.guildId, hour);

      switch (result.status) {
        case "invalid":
          await interaction.editReply(t(lang, "hourAdd.invalid"));
          return;
        case "exists":
          await interaction.editReply(t(lang, "quizHour.exists", { hour }));
          return;
        case "added":
          await interaction.editReply(t(lang, "quizHour.added", { hour, hours: formatHours(result.hours, lang) }));
          await LoggerService.info(`Heure de quiz ajoutée (${hour}h) pour le serveur ${interaction.guildId}`);
          return;
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'ajout d'une heure de quiz: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "quiz-hour-remove",
    description: "Retire une heure d'envoi automatique de quiz (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async removeQuizHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à retirer",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23
    })
    hour: number,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const result = await GuildSettingsService.removeQuizHour(interaction.guildId, hour);

      if (result.status === "not-present") {
        await interaction.editReply(t(lang, "quizHour.notPresent", { hour }));
        return;
      }

      if (result.emptied) {
        await interaction.editReply(t(lang, "quizHour.emptied", { hour }));
      } else {
        await interaction.editReply(t(lang, "quizHour.removed", { hour, hours: formatHours(result.hours, lang) }));
      }
      await LoggerService.info(`Heure de quiz retirée (${hour}h) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors du retrait d'une heure de quiz: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "anecdote-history",
    description: "Affiche l'historique des anecdotes envoyées sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async anecdoteHistory(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const data = await AnecdoteService.getHistoryPage(interaction.guildId, 0);
      await interaction.editReply(buildHistoryView(data, lang));
    } catch (error) {
      await LoggerService.error(`Erreur /anecdote-history: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "level",
    description: "Affiche le niveau et l'XP d'un membre"
  })
  async level(
    @SlashOption({
      name: "membre",
      description: "Le membre à consulter (toi par défaut)",
      required: false,
      type: ApplicationCommandOptionType.User
    })
    member: User | null,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "level.notInGuild"));
        return;
      }

      const target = member ?? interaction.user;
      const stats = await LevelService.getStats(interaction.guildId, target.id);
      const nextLevelXp = LevelService.xpForLevel(stats.level + 1);

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "level.title", { user: target.username }))
        .setColor(0x5865F2)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: t(lang, "level.level"), value: `${stats.level}`, inline: true },
          { name: t(lang, "level.xp"), value: `${stats.xp} / ${nextLevelXp}`, inline: true },
          { name: t(lang, "level.quiz"), value: `${stats.quizCorrect} / ${stats.quizAnswered}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur /level: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "leaderboard",
    description: "Classement XP du serveur"
  })
  async leaderboard(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "level.notInGuild"));
        return;
      }

      const entries = await LevelService.xpLeaderboard(interaction.guildId, 10);
      if (entries.length === 0) {
        await interaction.editReply(t(lang, "leaderboard.empty"));
        return;
      }

      const lines = entries.map((entry, index) =>
        t(lang, "leaderboard.xpLine", { rank: index + 1, user: entry.userId, level: entry.level, xp: entry.xp })
      );

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "leaderboard.xpTitle"))
        .setColor(0x5865F2)
        .setDescription(lines.join("\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur /leaderboard: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "quiz-leaderboard",
    description: "Classement des bonnes réponses au quiz"
  })
  async quizLeaderboard(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "level.notInGuild"));
        return;
      }

      const entries = await LevelService.quizLeaderboard(interaction.guildId, 10);
      if (entries.length === 0) {
        await interaction.editReply(t(lang, "leaderboard.quizEmpty"));
        return;
      }

      const lines = entries.map((entry, index) =>
        t(lang, "leaderboard.quizLine", { rank: index + 1, user: entry.userId, correct: entry.quizCorrect, answered: entry.quizAnswered })
      );

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "leaderboard.quizTitle"))
        .setColor(0x5865F2)
        .setDescription(lines.join("\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur /quiz-leaderboard: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @ButtonComponent({ id: "vote:up" })
  async voteUp(interaction: ButtonInteraction): Promise<void> {
    await this.handleVote(interaction, 1);
  }

  @ButtonComponent({ id: "vote:down" })
  async voteDown(interaction: ButtonInteraction): Promise<void> {
    await this.handleVote(interaction, -1);
  }

  private async handleVote(interaction: ButtonInteraction, value: 1 | -1): Promise<void> {
    try {
      const result = await AnecdoteService.applyVote(interaction.message.id, interaction.user.id, value);
      if (!result) {
        await interaction.deferUpdate();
        return;
      }
      await interaction.update({ components: AnecdoteService.voteComponents(result.upvotes, result.downvotes) });

      if (interaction.guildId) {
        const award = await LevelService.award(interaction.guildId, interaction.user.id, "vote", interaction.message.id);
        if (award?.leveledUp) {
          const lang = await langOf(interaction.guildId);
          await interaction.followUp({ content: t(lang, "level.up", { user: interaction.user.id, level: award.level }) });
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors d'un vote: ${error}`);
      try {
        await interaction.deferUpdate();
      } catch {
        // interaction déjà traitée
      }
    }
  }

  @ButtonComponent({ id: /^hist:(prev|next):\d+$/ })
  async historyPage(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guildId) {
        return;
      }

      const lang = await langOf(interaction.guildId);
      const page = parseInt(interaction.customId.split(":")[2] ?? "0", 10) || 0;
      const data = await AnecdoteService.getHistoryPage(interaction.guildId, page);
      await interaction.update(buildHistoryView(data, lang));
    } catch (error) {
      await LoggerService.error(`Erreur pagination historique: ${error}`);
    }
  }
}
