import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  NewsChannel,
  Role,
  EmbedBuilder,
  ApplicationCommandOptionType,
} from "discord.js";
import { NewsService } from "../services/NewsService";
import { LoggerService } from "../services/LoggerService";
import { GuildSettingsService, DEFAULT_LANGUAGE, type Language } from "../services/GuildSettingsService";
import { t } from "../i18n";
import { prisma } from "../lib/prisma";

/** Récupère la langue d'un serveur (ou le français par défaut hors serveur). */
async function langOf(guildId: string | null): Promise<Language> {
  return guildId ? GuildSettingsService.getLanguage(guildId) : DEFAULT_LANGUAGE;
}

/** Formate une liste d'heures pour l'affichage selon la langue. */
function formatHours(hours: number[], lang: Language): string {
  const fmt = lang === "fr" ? (h: number) => `${h}h` : (h: number) => `${h}:00`;
  return hours.map(fmt).join(", ");
}

@Discord()
export class NewsController {
  @Slash({
    name: "news-setup",
    description: "Configure le salon qui recevra les news quotidiennes",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async setupNews(
    @SlashOption({
      name: "channel",
      description: "Le salon où envoyer les news",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
    })
    channel: TextChannel | NewsChannel,
    @SlashOption({
      name: "role",
      description: "Le rôle à mentionner lors de l'envoi (optionnel)",
      required: false,
      type: ApplicationCommandOptionType.Role,
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

      const existing = await prisma.newsChannel.findUnique({
        where: { guildId_channelId: { guildId: interaction.guildId, channelId: channel.id } },
      });

      if (existing) {
        await prisma.newsChannel.update({
          where: { id: existing.id },
          data: { roleId: role?.id || null },
        });
        await interaction.editReply(t(lang, "newsSetup.updated", { channel: channel.id, roleSuffix }));
      } else {
        await prisma.newsChannel.create({
          data: { guildId: interaction.guildId, channelId: channel.id, roleId: role?.id || null },
        });
        await interaction.editReply(t(lang, "newsSetup.created", { channel: channel.id, roleSuffix }));
      }

      await LoggerService.success(`Salon de news configuré: ${channel.name} (${interaction.guildId})`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la configuration du salon de news: ${error}`);
      await interaction.editReply(t(lang, "newsSetup.error"));
    }
  }

  @Slash({
    name: "news-remove",
    description: "Retire un salon de la configuration des news",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async removeNews(
    @SlashOption({
      name: "channel",
      description: "Le salon à retirer",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
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

      const deleted = await prisma.newsChannel.deleteMany({
        where: { guildId: interaction.guildId, channelId: channel.id },
      });

      if (deleted.count > 0) {
        await interaction.editReply(t(lang, "newsRemove.success", { channel: channel.id }));
        await LoggerService.info(`Salon de news retiré: ${channel.name} (${interaction.guildId})`);
      } else {
        await interaction.editReply(t(lang, "newsRemove.notConfigured", { channel: channel.id }));
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de la suppression du salon de news: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "news-list",
    description: "Liste les salons configurés pour les news sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async listNews(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      const channels = await prisma.newsChannel.findMany({ where: { guildId: interaction.guildId } });

      if (channels.length === 0) {
        await interaction.editReply(t(lang, "newsList.empty"));
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "newsList.title"))
        .setColor(0x5865F2)
        .setDescription(
          channels
            .map((c) => (c.roleId ? `<#${c.channelId}> → <@&${c.roleId}>` : `<#${c.channelId}>`))
            .join("\n")
        )
        .setFooter({ text: t(lang, "newsList.footer", { count: channels.length }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors du listage des salons de news: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "newshour-add",
    description: "Ajoute une heure d'envoi quotidien des news (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async addNewsHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à ajouter",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23,
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

      const result = await GuildSettingsService.addNewsHour(interaction.guildId, hour);

      if (result.status === "invalid") {
        await interaction.editReply(t(lang, "hourAdd.invalid"));
        return;
      }

      if (result.status === "exists") {
        await interaction.editReply(t(lang, "newsHour.exists", { hour }));
        return;
      }

      await interaction.editReply(
        t(lang, "newsHour.added", { hour, hours: formatHours(result.hours, lang) })
      );
      await LoggerService.info(`Heure de news ajoutée (${hour}h) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'ajout d'une heure de news: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "newshour-remove",
    description: "Retire une heure d'envoi quotidien des news (0-23)",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async removeNewsHour(
    @SlashOption({
      name: "hour",
      description: "L'heure (0-23) à retirer",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 23,
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

      const result = await GuildSettingsService.removeNewsHour(interaction.guildId, hour);

      if (result.status === "not-present") {
        await interaction.editReply(t(lang, "newsHour.notPresent", { hour }));
        return;
      }

      if (result.emptied) {
        await interaction.editReply(t(lang, "newsHour.emptied", { hour }));
      } else {
        await interaction.editReply(
          t(lang, "newsHour.removed", { hour, hours: formatHours(result.hours, lang) })
        );
      }
      await LoggerService.info(`Heure de news retirée (${hour}h) pour le serveur ${interaction.guildId}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors du retrait d'une heure de news: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }

  @Slash({
    name: "news",
    description: "Envoie immédiatement le digest de news dans les salons configurés",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
  })
  async sendNews(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });
    const lang = await langOf(interaction.guildId);

    try {
      if (!interaction.guildId) {
        await interaction.editReply(t(lang, "common.notInGuild"));
        return;
      }

      // `sendDigestToGuild` renvoie une liste vide aussi bien quand aucun
      // salon n'est configuré que quand le sourcing a échoué. On distingue
      // ici les deux cas : sans cette vérification, un admin qui n'a jamais
      // lancé `/news-setup` se voit répondre « réessaie plus tard » alors
      // qu'aucune attente ne réglera son problème.
      const configured = await prisma.newsChannel.count({ where: { guildId: interaction.guildId } });

      if (configured === 0) {
        await interaction.editReply(t(lang, "news.noChannel"));
        return;
      }

      const delivered = await NewsService.sendDigestToGuild(interaction.guildId);

      if (delivered.length === 0) {
        await interaction.editReply(t(lang, "news.failed"));
        return;
      }

      await interaction.editReply(
        t(lang, "news.success", { channels: delivered.map((id) => `<#${id}>`).join(", ") })
      );
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi manuel des news: ${error}`);
      await interaction.editReply(t(lang, "common.error"));
    }
  }
}
