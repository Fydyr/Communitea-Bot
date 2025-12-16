import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  GuildMember,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  User,
  EmbedBuilder,
  Colors,
} from "discord.js";
import ModerationService from "../services/ModerationService";
import { InfractionType } from "../models/Infraction";
import { createEmbed, createErrorEmbed } from "../utils/embed";

@Discord()
export class ModerationInfoController {
  @Slash({ description: "Voir les avertissements d'un membre" })
  async warnings(
    @SlashOption({
      description: "Le membre à consulter",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Cette commande doit être utilisée dans un serveur")],
        ephemeral: true,
      });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de voir les infractions")],
        ephemeral: true,
      });
      return;
    }

    const warnings = ModerationService.getActiveWarnings(user.id, interaction.guild.id);

    if (warnings.length === 0) {
      await interaction.reply({
        embeds: [
          createEmbed(
            "📋 Avertissements",
            `${user} n'a aucun avertissement actif`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(`⚠️ Avertissements de ${user.tag}`)
      .setDescription(`Total: ${warnings.length} avertissement(s) actif(s)`)
      .setThumbnail(user.displayAvatarURL());

    warnings.slice(0, 10).forEach((warning, index) => {
      const timestamp = Math.floor(warning.timestamp.getTime() / 1000);
      embed.addFields({
        name: `${index + 1}. ${warning.id}`,
        value: `**Raison:** ${warning.reason}\n**Modérateur:** <@${warning.moderatorId}>\n**Date:** <t:${timestamp}:R>`,
        inline: false,
      });
    });

    if (warnings.length > 10) {
      embed.setFooter({
        text: `${warnings.length - 10} avertissement(s) supplémentaire(s) non affiché(s)`,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  @Slash({ description: "Voir l'historique de modération d'un membre" })
  async history(
    @SlashOption({
      description: "Le membre à consulter",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Cette commande doit être utilisée dans un serveur")],
        ephemeral: true,
      });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de voir les infractions")],
        ephemeral: true,
      });
      return;
    }

    const infractions = ModerationService.getUserInfractions(user.id, interaction.guild.id);

    if (infractions.length === 0) {
      await interaction.reply({
        embeds: [
          createEmbed(
            "📋 Historique",
            `${user} n'a aucune infraction enregistrée`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const sortedInfractions = infractions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const stats = {
      warns: infractions.filter((i) => i.type === InfractionType.WARN).length,
      kicks: infractions.filter((i) => i.type === InfractionType.KICK).length,
      bans: infractions.filter((i) => i.type === InfractionType.BAN).length,
      timeouts: infractions.filter((i) => i.type === InfractionType.TIMEOUT).length,
    };

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`📋 Historique de ${user.tag}`)
      .setDescription(
        `**Total:** ${infractions.length} infraction(s)\n` +
        `⚠️ Avertissements: ${stats.warns}\n` +
        `👢 Expulsions: ${stats.kicks}\n` +
        `🔨 Bannissements: ${stats.bans}\n` +
        `⏱️ Timeouts: ${stats.timeouts}`
      )
      .setThumbnail(user.displayAvatarURL());

    const icons: Record<InfractionType, string> = {
      [InfractionType.WARN]: "⚠️",
      [InfractionType.KICK]: "👢",
      [InfractionType.BAN]: "🔨",
      [InfractionType.TIMEOUT]: "⏱️",
      [InfractionType.UNBAN]: "✅",
    };

    sortedInfractions.forEach((infraction, index) => {
      const timestamp = Math.floor(infraction.timestamp.getTime() / 1000);
      const status = infraction.active ? "🟢 Actif" : "⚫ Inactif";
      embed.addFields({
        name: `${index + 1}. ${icons[infraction.type]} ${infraction.type} - ${status}`,
        value: `**Raison:** ${infraction.reason}\n**Modérateur:** <@${infraction.moderatorId}>\n**Date:** <t:${timestamp}:R>\n**ID:** ${infraction.id}`,
        inline: false,
      });
    });

    if (infractions.length > 10) {
      embed.setFooter({
        text: `${infractions.length - 10} infraction(s) supplémentaire(s) non affichée(s)`,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  @Slash({ description: "Voir les logs de modération récents du serveur" })
  async modlogs(
    @SlashOption({
      description: "Nombre de logs à afficher (max 25)",
      name: "limite",
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 25,
    })
    limit: number = 10,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Cette commande doit être utilisée dans un serveur")],
        ephemeral: true,
      });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de voir les logs")],
        ephemeral: true,
      });
      return;
    }

    const infractions = ModerationService.getGuildInfractions(interaction.guild.id, limit);

    if (infractions.length === 0) {
      await interaction.reply({
        embeds: [createEmbed("📋 Logs de modération", "Aucune infraction enregistrée")],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("📋 Logs de modération récents")
      .setDescription(`${infractions.length} dernière(s) infraction(s)`)
      .setTimestamp();

    const icons: Record<InfractionType, string> = {
      [InfractionType.WARN]: "⚠️",
      [InfractionType.KICK]: "👢",
      [InfractionType.BAN]: "🔨",
      [InfractionType.TIMEOUT]: "⏱️",
      [InfractionType.UNBAN]: "✅",
    };

    infractions.forEach((infraction, index) => {
      const timestamp = Math.floor(infraction.timestamp.getTime() / 1000);
      embed.addFields({
        name: `${icons[infraction.type]} ${infraction.type} - <t:${timestamp}:R>`,
        value: `**Utilisateur:** <@${infraction.userId}>\n**Modérateur:** <@${infraction.moderatorId}>\n**Raison:** ${infraction.reason}\n**ID:** ${infraction.id}`,
        inline: false,
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  @Slash({ description: "Voir les statistiques de modération du serveur" })
  async stats(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Cette commande doit être utilisée dans un serveur")],
        ephemeral: true,
      });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de voir les statistiques")],
        ephemeral: true,
      });
      return;
    }

    const infractions = ModerationService.getGuildInfractions(interaction.guild.id, 1000);

    const stats = {
      total: infractions.length,
      active: infractions.filter((i) => i.active).length,
      warns: infractions.filter((i) => i.type === InfractionType.WARN).length,
      kicks: infractions.filter((i) => i.type === InfractionType.KICK).length,
      bans: infractions.filter((i) => i.type === InfractionType.BAN).length,
      timeouts: infractions.filter((i) => i.type === InfractionType.TIMEOUT).length,
      unbans: infractions.filter((i) => i.type === InfractionType.UNBAN).length,
    };

    const last24h = infractions.filter(
      (i) => Date.now() - i.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    const last7d = infractions.filter(
      (i) => Date.now() - i.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    ).length;

    const topModerators = new Map<string, number>();
    infractions.forEach((i) => {
      topModerators.set(i.moderatorId, (topModerators.get(i.moderatorId) || 0) + 1);
    });

    const sortedModerators = Array.from(topModerators.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("📊 Statistiques de modération")
      .setDescription(`Serveur: **${interaction.guild.name}**`)
      .addFields(
        {
          name: "📈 Aperçu général",
          value: `**Total:** ${stats.total} infractions\n**Actives:** ${stats.active} infractions\n**24h:** ${last24h} infractions\n**7j:** ${last7d} infractions`,
          inline: true,
        },
        {
          name: "📋 Par type",
          value: `⚠️ Warns: ${stats.warns}\n👢 Kicks: ${stats.kicks}\n🔨 Bans: ${stats.bans}\n⏱️ Timeouts: ${stats.timeouts}\n✅ Unbans: ${stats.unbans}`,
          inline: true,
        }
      )
      .setTimestamp();

    if (sortedModerators.length > 0) {
      const modList = sortedModerators
        .map(([id, count], index) => `${index + 1}. <@${id}>: ${count}`)
        .join("\n");
      embed.addFields({
        name: "👮 Top modérateurs",
        value: modList,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
