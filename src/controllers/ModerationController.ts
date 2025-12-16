import {
  Discord,
  Slash,
  SlashOption,
} from "discordx";
import {
  CommandInteraction,
  GuildMember,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  User,
  TextChannel,
} from "discord.js";
import ModerationService from "../services/ModerationService";
import { createEmbed, createErrorEmbed, createSuccessEmbed } from "../utils/embed";
import { config } from "../config";

@Discord()
export class ModerationController {
  @Slash({ description: "Avertir un membre" })
  async warn(
    @SlashOption({
      description: "Le membre à avertir",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      description: "Raison de l'avertissement",
      name: "raison",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
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
        embeds: [createErrorEmbed("Vous n'avez pas la permission de modérer les membres")],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Membre introuvable")],
        ephemeral: true,
      });
      return;
    }

    if (member.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous ne pouvez pas vous avertir vous-même")],
        ephemeral: true,
      });
      return;
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous ne pouvez pas avertir un administrateur")],
        ephemeral: true,
      });
      return;
    }

    const { infraction, autoAction } = await ModerationService.warnUser(
      member,
      interaction.user,
      reason
    );

    const warnings = ModerationService.getActiveWarnings(member.id, interaction.guild.id);

    let description = `${user} a reçu un avertissement\n\n**Raison:** ${reason}\n**Avertissements actifs:** ${warnings.length}`;

    if (autoAction) {
      description += `\n\n⚡ **Action automatique:** ${autoAction === "BAN" ? "Bannissement" : "Expulsion"}`;
    }

    const embed = createEmbed("⚠️ Avertissement émis", description);
    embed.addFields({ name: "ID", value: infraction.id, inline: true });

    await interaction.reply({ embeds: [embed] });

    if (config.modLogChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.modLogChannelId);
      if (logChannel?.isTextBased()) {
        await ModerationService.sendModLogToChannel(
          logChannel as TextChannel,
          infraction,
          member
        );
      }
    }
  }

  @Slash({ description: "Retirer un avertissement" })
  async unwarn(
    @SlashOption({
      description: "Le membre dont retirer l'avertissement",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      description: "ID de l'infraction spécifique (optionnel)",
      name: "id",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    infractionId: string | undefined,
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
        embeds: [createErrorEmbed("Vous n'avez pas la permission de modérer les membres")],
        ephemeral: true,
      });
      return;
    }

    const removed = await ModerationService.unwarnUser(
      user.id,
      interaction.guild.id,
      interaction.user,
      infractionId
    );

    if (removed === 0) {
      await interaction.reply({
        embeds: [createErrorEmbed("Aucun avertissement actif trouvé")],
        ephemeral: true,
      });
      return;
    }

    const warnings = ModerationService.getActiveWarnings(user.id, interaction.guild.id);

    await interaction.reply({
      embeds: [
        createSuccessEmbed(
          `✅ Avertissement retiré pour ${user}\n**Avertissements restants:** ${warnings.length}`
        ),
      ],
    });
  }

  @Slash({ description: "Expulser un membre" })
  async kick(
    @SlashOption({
      description: "Le membre à expulser",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      description: "Raison de l'expulsion",
      name: "raison",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
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
    if (!moderator.permissions.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission d'expulser des membres")],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Membre introuvable")],
        ephemeral: true,
      });
      return;
    }

    if (member.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous ne pouvez pas vous expulser vous-même")],
        ephemeral: true,
      });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        embeds: [createErrorEmbed("Je ne peux pas expulser ce membre (permissions insuffisantes)")],
        ephemeral: true,
      });
      return;
    }

    const infraction = await ModerationService.kickUser(member, interaction.user, reason);

    const embed = createEmbed(
      "👢 Membre expulsé",
      `${user} a été expulsé du serveur\n\n**Raison:** ${reason}`
    );
    embed.addFields({ name: "ID", value: infraction.id, inline: true });

    await interaction.reply({ embeds: [embed] });

    if (config.modLogChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.modLogChannelId);
      if (logChannel?.isTextBased()) {
        await ModerationService.sendModLogToChannel(
          logChannel as TextChannel,
          infraction,
          member
        );
      }
    }
  }

  @Slash({ description: "Bannir un membre" })
  async ban(
    @SlashOption({
      description: "Le membre à bannir",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      description: "Raison du bannissement",
      name: "raison",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
    @SlashOption({
      description: "Nombre de jours de messages à supprimer (0-7)",
      name: "messages",
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 7,
    })
    deleteMessageDays: number = 1,
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
    if (!moderator.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de bannir des membres")],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Membre introuvable")],
        ephemeral: true,
      });
      return;
    }

    if (member.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous ne pouvez pas vous bannir vous-même")],
        ephemeral: true,
      });
      return;
    }

    if (!member.bannable) {
      await interaction.reply({
        embeds: [createErrorEmbed("Je ne peux pas bannir ce membre (permissions insuffisantes)")],
        ephemeral: true,
      });
      return;
    }

    const infraction = await ModerationService.banUser(
      member,
      interaction.user,
      reason,
      deleteMessageDays
    );

    const embed = createEmbed(
      "🔨 Membre banni",
      `${user} a été banni du serveur\n\n**Raison:** ${reason}`
    );
    embed.addFields({ name: "ID", value: infraction.id, inline: true });

    await interaction.reply({ embeds: [embed] });

    if (config.modLogChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.modLogChannelId);
      if (logChannel?.isTextBased()) {
        await ModerationService.sendModLogToChannel(
          logChannel as TextChannel,
          infraction,
          member
        );
      }
    }
  }

  @Slash({ description: "Débannir un utilisateur" })
  async unban(
    @SlashOption({
      description: "ID de l'utilisateur à débannir",
      name: "id",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    userId: string,
    @SlashOption({
      description: "Raison du débannissement",
      name: "raison",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
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
    if (!moderator.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous n'avez pas la permission de débannir des membres")],
        ephemeral: true,
      });
      return;
    }

    try {
      const infraction = await ModerationService.unbanUser(
        interaction.guild,
        userId,
        interaction.user,
        reason
      );

      const embed = createSuccessEmbed(
        `✅ Utilisateur <@${userId}> débanni\n\n**Raison:** ${reason}`
      );
      embed.addFields({ name: "ID", value: infraction.id, inline: true });

      await interaction.reply({ embeds: [embed] });

      if (config.modLogChannelId) {
        const logChannel = await interaction.guild.channels.fetch(config.modLogChannelId);
        if (logChannel?.isTextBased()) {
          await ModerationService.sendModLogToChannel(
            logChannel as TextChannel,
            infraction
          );
        }
      }
    } catch (error) {
      await interaction.reply({
        embeds: [createErrorEmbed("Impossible de débannir cet utilisateur (n'est pas banni ?)")],
        ephemeral: true,
      });
    }
  }

  @Slash({ description: "Mettre un timeout à un membre" })
  async timeout(
    @SlashOption({
      description: "Le membre à timeout",
      name: "membre",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      description: "Durée en minutes",
      name: "duree",
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 40320,
    })
    duration: number,
    @SlashOption({
      description: "Raison du timeout",
      name: "raison",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    reason: string,
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
        embeds: [createErrorEmbed("Vous n'avez pas la permission de timeout des membres")],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Membre introuvable")],
        ephemeral: true,
      });
      return;
    }

    if (member.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed("Vous ne pouvez pas vous timeout vous-même")],
        ephemeral: true,
      });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        embeds: [createErrorEmbed("Je ne peux pas timeout ce membre (permissions insuffisantes)")],
        ephemeral: true,
      });
      return;
    }

    const durationMs = duration * 60 * 1000;
    const infraction = await ModerationService.timeoutUser(
      member,
      interaction.user,
      durationMs,
      reason
    );

    const embed = createEmbed(
      "⏱️ Timeout appliqué",
      `${user} a reçu un timeout de ${duration} minutes\n\n**Raison:** ${reason}`
    );
    embed.addFields({ name: "ID", value: infraction.id, inline: true });

    await interaction.reply({ embeds: [embed] });

    if (config.modLogChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.modLogChannelId);
      if (logChannel?.isTextBased()) {
        await ModerationService.sendModLogToChannel(
          logChannel as TextChannel,
          infraction,
          member
        );
      }
    }
  }

  @Slash({ description: "Retirer le timeout d'un membre" })
  async untimeout(
    @SlashOption({
      description: "Le membre dont retirer le timeout",
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
        embeds: [createErrorEmbed("Vous n'avez pas la permission de modérer les membres")],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("Membre introuvable")],
        ephemeral: true,
      });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({
        embeds: [createErrorEmbed("Ce membre n'a pas de timeout actif")],
        ephemeral: true,
      });
      return;
    }

    await ModerationService.removeTimeout(member, interaction.user);

    await interaction.reply({
      embeds: [createSuccessEmbed(`✅ Timeout retiré pour ${user}`)],
    });
  }
}
