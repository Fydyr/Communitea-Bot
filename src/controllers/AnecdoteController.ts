import { Discord, Slash, SlashOption } from "discordx";
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
import { prisma } from "../lib/prisma";
import { config } from "../config";

@Discord()
export class AnecdoteController {
  @Slash({
    name: "anecdote-setup",
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

    try {
      if (!interaction.guildId) {
        await interaction.editReply("❌ Cette commande doit être utilisée dans un serveur.");
        return;
      }

      // Vérifier si le channel est déjà configuré
      const existing = await prisma.anecdoteChannel.findUnique({
        where: {
          guildId_channelId: {
            guildId: interaction.guildId,
            channelId: channel.id
          }
        }
      });

      if (existing) {
        // Mettre à jour le rôle
        await prisma.anecdoteChannel.update({
          where: { id: existing.id },
          data: { roleId: role?.id || null }
        });
        await interaction.editReply(`✅ Configuration mise à jour pour <#${channel.id}>${role ? ` avec mention de <@&${role.id}>` : ""}.`);
      } else {
        // Créer une nouvelle configuration
        await prisma.anecdoteChannel.create({
          data: {
            guildId: interaction.guildId,
            channelId: channel.id,
            roleId: role?.id || null
          }
        });
        await interaction.editReply(`✅ Les anecdotes seront envoyées dans <#${channel.id}>${role ? ` avec mention de <@&${role.id}>` : ""}.`);
      }

      await LoggerService.success(`Anecdote channel configuré: ${channel.name} (${interaction.guildId})`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de la configuration du channel d'anecdotes: ${error}`);
      await interaction.editReply("❌ Une erreur est survenue lors de la configuration.");
    }
  }

  @Slash({
    name: "anecdote-remove",
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

    try {
      if (!interaction.guildId) {
        await interaction.editReply("❌ Cette commande doit être utilisée dans un serveur.");
        return;
      }

      const deleted = await prisma.anecdoteChannel.deleteMany({
        where: {
          guildId: interaction.guildId,
          channelId: channel.id
        }
      });

      if (deleted.count > 0) {
        await interaction.editReply(`✅ Le channel <#${channel.id}> ne recevra plus d'anecdotes.`);
        await LoggerService.info(`Anecdote channel retiré: ${channel.name} (${interaction.guildId})`);
      } else {
        await interaction.editReply(`⚠️ Le channel <#${channel.id}> n'était pas configuré pour les anecdotes.`);
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de la suppression du channel d'anecdotes: ${error}`);
      await interaction.editReply("❌ Une erreur est survenue lors de la suppression.");
    }
  }

  @Slash({
    name: "anecdote-list",
    description: "Liste les channels configurés pour les anecdotes sur ce serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async listAnecdotes(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    try {
      if (!interaction.guildId) {
        await interaction.editReply("❌ Cette commande doit être utilisée dans un serveur.");
        return;
      }

      const channels = await prisma.anecdoteChannel.findMany({
        where: { guildId: interaction.guildId }
      });

      if (channels.length === 0) {
        await interaction.editReply("📭 Aucun channel n'est configuré pour les anecdotes sur ce serveur.\nUtilise `/anecdote-setup` pour en configurer un.");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("📚 Channels d'anecdotes configurés")
        .setColor(0x5865F2)
        .setDescription(
          channels.map((c: { channelId: string; roleId: string | null }) =>
            `• <#${c.channelId}>${c.roleId ? ` → <@&${c.roleId}>` : ""}`
          ).join("\n")
        )
        .setFooter({ text: `${channels.length} channel(s) configuré(s)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors de la liste des channels d'anecdotes: ${error}`);
      await interaction.editReply("❌ Une erreur est survenue.");
    }
  }

  @Slash({
    name: "send-anecdote",
    description: "Envoie immédiatement une anecdote dans les channels configurés du serveur",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async sendAnecdote(interaction: CommandInteraction): Promise<void> {
    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", flags: 64 });
      return;
    }

    await interaction.deferReply({ flags: 64 });

    try {
      if (!interaction.guildId) {
        await interaction.editReply("❌ Cette commande doit être utilisée dans un serveur.");
        return;
      }

      const sentChannelIds = await AnecdoteService.sendAnecdotesToGuild(interaction.guildId);

      if (sentChannelIds.length === 0) {
        await interaction.editReply("❌ Aucun channel n'est configuré pour les anecdotes sur ce serveur.\nUtilise `/anecdote-setup` pour en configurer un.");
        return;
      }

      const channelMentions = sentChannelIds.map((id) => `<#${id}>`).join(", ");
      await interaction.editReply(`✅ Anecdote envoyée dans : ${channelMentions}`);
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'envoi manuel de l'anecdote: ${error}`);
      await interaction.editReply("❌ Erreur lors de l'envoi de l'anecdote. Vérifiez les logs.");
    }
  }

  @Slash({
    name: "anecdote-stats",
    description: "Affiche les statistiques des anecdotes",
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  })
  async anecdoteStats(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    try {
      const totalChannels = await prisma.anecdoteChannel.count();
      const guildChannels = interaction.guildId
        ? await prisma.anecdoteChannel.count({ where: { guildId: interaction.guildId } })
        : 0;
      const totalAnecdotes = await AnecdoteService.getSentAnecdotesCount();

      const embed = new EmbedBuilder()
        .setTitle("📊 Statistiques des anecdotes")
        .setColor(0x5865F2)
        .addFields(
          { name: "📤 Anecdotes envoyées", value: `${totalAnecdotes}`, inline: true },
          { name: "🌐 Channels (global)", value: `${totalChannels}`, inline: true },
          { name: "📍 Channels (ce serveur)", value: `${guildChannels}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'affichage des stats: ${error}`);
      await interaction.editReply("❌ Une erreur est survenue.");
    }
  }
}
