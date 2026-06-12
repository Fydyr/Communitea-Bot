import { Discord, Slash, SlashOption, SlashChoice } from "discordx";
import {
  CommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  NewsChannel,
  Role,
  EmbedBuilder,
  ApplicationCommandOptionType
} from "discord.js";
import { AnecdoteService } from "../services/AnecdoteService";
import { LoggerService } from "../services/LoggerService";
import {
  GuildSettingsService,
  DEFAULT_LANGUAGE,
  type Language
} from "../services/GuildSettingsService";
import { t, LANGUAGE_LABELS } from "../i18n";
import { prisma } from "../lib/prisma";
import { config } from "../config";

/** Récupère la langue d'un serveur (ou le français par défaut hors serveur). */
async function langOf(guildId: string | null): Promise<Language> {
  return guildId ? GuildSettingsService.getLanguage(guildId) : DEFAULT_LANGUAGE;
}

/** Formate une liste d'heures pour l'affichage selon la langue. */
function formatHours(hours: number[], lang: Language): string {
  if (hours.length === 0) {
    return t(lang, "schedule.noHours");
  }
  const fmt = lang === "fr" ? (h: number) => `${h}h` : (h: number) => `${h}:00`;
  return hours.map(fmt).join(", ");
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
          { name: t(lang, "schedule.language"), value: LANGUAGE_LABELS[settings.language], inline: true }
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
}
