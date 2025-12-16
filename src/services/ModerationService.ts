import {
  GuildMember,
  User,
  EmbedBuilder,
  Colors,
  TextChannel,
  Guild,
} from "discord.js";
import InfractionModel, {
  Infraction,
  InfractionType,
} from "../models/Infraction";
import { LoggerService } from "./LoggerService";

export class ModerationService {
  private static instance: ModerationService;
  private maxWarningsBeforeBan: number = 5;
  private maxWarningsBeforeKick: number = 3;

  private constructor() {}

  static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  setMaxWarnings(beforeKick: number, beforeBan: number): void {
    this.maxWarningsBeforeKick = beforeKick;
    this.maxWarningsBeforeBan = beforeBan;
  }

  async warnUser(
    member: GuildMember,
    moderator: User,
    reason: string
  ): Promise<{ infraction: Infraction; autoAction?: string }> {
    const infraction = InfractionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      moderatorId: moderator.id,
      type: InfractionType.WARN,
      reason,
    });

    await LoggerService.info(
      `⚠️ ${member.user.tag} a reçu un avertissement de ${moderator.tag} - Raison: ${reason}`
    );

    const warnings = InfractionModel.findWarningsByUserId(
      member.id,
      member.guild.id
    );
    const warningCount = warnings.length;

    let autoAction: string | undefined;

    if (warningCount >= this.maxWarningsBeforeBan) {
      await this.banUser(
        member,
        moderator,
        `Bannissement automatique après ${warningCount} avertissements`
      );
      autoAction = "BAN";
    } else if (warningCount >= this.maxWarningsBeforeKick) {
      await this.kickUser(
        member,
        moderator,
        `Expulsion automatique après ${warningCount} avertissements`
      );
      autoAction = "KICK";
    }

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("⚠️ Avertissement")
        .setDescription(
          `Vous avez reçu un avertissement sur **${member.guild.name}**`
        )
        .addFields(
          { name: "Raison", value: reason },
          {
            name: "Avertissements actifs",
            value: `${warningCount}/${this.maxWarningsBeforeBan}`,
          },
          {
            name: "Modérateur",
            value: moderator.tag,
          }
        )
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch (error) {
      await LoggerService.warning(
        `Impossible d'envoyer un DM à ${member.user.tag}`
      );
    }

    return { infraction, autoAction };
  }

  async unwarnUser(
    userId: string,
    guildId: string,
    moderator: User,
    infractionId?: string
  ): Promise<number> {
    let removed = 0;

    if (infractionId) {
      const infraction = InfractionModel.findById(infractionId);
      if (
        infraction &&
        infraction.type === InfractionType.WARN &&
        infraction.active
      ) {
        InfractionModel.deactivate(infractionId);
        removed = 1;
      }
    } else {
      const warnings = InfractionModel.findWarningsByUserId(userId, guildId);
      if (warnings.length > 0) {
        const latest = warnings[warnings.length - 1];
        InfractionModel.deactivate(latest.id);
        removed = 1;
      }
    }

    if (removed > 0) {
      await LoggerService.info(
        `✅ ${moderator.tag} a retiré ${removed} avertissement(s) de l'utilisateur ${userId}`
      );
    }

    return removed;
  }

  async kickUser(
    member: GuildMember,
    moderator: User,
    reason: string
  ): Promise<Infraction> {
    const infraction = InfractionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      moderatorId: moderator.id,
      type: InfractionType.KICK,
      reason,
    });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("👢 Expulsion")
        .setDescription(
          `Vous avez été expulsé de **${member.guild.name}**`
        )
        .addFields(
          { name: "Raison", value: reason },
          { name: "Modérateur", value: moderator.tag }
        )
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch (error) {
      await LoggerService.warning(
        `Impossible d'envoyer un DM à ${member.user.tag} avant l'expulsion`
      );
    }

    await member.kick(reason);
    await LoggerService.warning(
      `👢 ${member.user.tag} a été expulsé par ${moderator.tag} - Raison: ${reason}`
    );

    return infraction;
  }

  async banUser(
    member: GuildMember,
    moderator: User,
    reason: string,
    deleteMessageDays: number = 1
  ): Promise<Infraction> {
    const infraction = InfractionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      moderatorId: moderator.id,
      type: InfractionType.BAN,
      reason,
    });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.DarkRed)
        .setTitle("🔨 Bannissement")
        .setDescription(
          `Vous avez été banni de **${member.guild.name}**`
        )
        .addFields(
          { name: "Raison", value: reason },
          { name: "Modérateur", value: moderator.tag }
        )
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch (error) {
      await LoggerService.warning(
        `Impossible d'envoyer un DM à ${member.user.tag} avant le bannissement`
      );
    }

    await member.ban({ reason, deleteMessageDays });
    await LoggerService.error(
      `🔨 ${member.user.tag} a été banni par ${moderator.tag} - Raison: ${reason}`
    );

    return infraction;
  }

  async unbanUser(
    guild: Guild,
    userId: string,
    moderator: User,
    reason: string
  ): Promise<Infraction> {
    const infraction = InfractionModel.create({
      guildId: guild.id,
      userId: userId,
      moderatorId: moderator.id,
      type: InfractionType.UNBAN,
      reason,
    });

    await guild.members.unban(userId, reason);
    await LoggerService.success(
      `✅ L'utilisateur ${userId} a été débanni par ${moderator.tag} - Raison: ${reason}`
    );

    return infraction;
  }

  async timeoutUser(
    member: GuildMember,
    moderator: User,
    duration: number,
    reason: string
  ): Promise<Infraction> {
    const expiresAt = new Date(Date.now() + duration);

    const infraction = InfractionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      moderatorId: moderator.id,
      type: InfractionType.TIMEOUT,
      reason,
      expiresAt,
    });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("⏱️ Timeout")
        .setDescription(
          `Vous avez reçu un timeout sur **${member.guild.name}**`
        )
        .addFields(
          { name: "Raison", value: reason },
          {
            name: "Durée",
            value: this.formatDuration(duration),
          },
          { name: "Modérateur", value: moderator.tag }
        )
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch (error) {
      await LoggerService.warning(
        `Impossible d'envoyer un DM à ${member.user.tag}`
      );
    }

    await member.timeout(duration, reason);
    await LoggerService.warning(
      `⏱️ ${member.user.tag} a reçu un timeout de ${this.formatDuration(duration)} par ${moderator.tag} - Raison: ${reason}`
    );

    return infraction;
  }

  async removeTimeout(
    member: GuildMember,
    moderator: User
  ): Promise<void> {
    await member.timeout(null, `Timeout retiré par ${moderator.tag}`);
    await LoggerService.info(
      `✅ Timeout retiré pour ${member.user.tag} par ${moderator.tag}`
    );
  }

  getUserInfractions(userId: string, guildId?: string): Infraction[] {
    const infractions = InfractionModel.findByUserId(userId);
    if (guildId) {
      return infractions.filter((inf) => inf.guildId === guildId);
    }
    return infractions;
  }

  getActiveWarnings(userId: string, guildId: string): Infraction[] {
    return InfractionModel.findWarningsByUserId(userId, guildId);
  }

  getGuildInfractions(guildId: string, limit: number = 50): Infraction[] {
    const infractions = InfractionModel.findByGuildId(guildId);
    return infractions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async sendModLogToChannel(
    channel: TextChannel,
    infraction: Infraction,
    member?: GuildMember
  ): Promise<void> {
    const colors: Record<InfractionType, number> = {
      [InfractionType.WARN]: Colors.Yellow,
      [InfractionType.KICK]: Colors.Orange,
      [InfractionType.BAN]: Colors.Red,
      [InfractionType.TIMEOUT]: Colors.Orange,
      [InfractionType.UNBAN]: Colors.Green,
    };

    const icons: Record<InfractionType, string> = {
      [InfractionType.WARN]: "⚠️",
      [InfractionType.KICK]: "👢",
      [InfractionType.BAN]: "🔨",
      [InfractionType.TIMEOUT]: "⏱️",
      [InfractionType.UNBAN]: "✅",
    };

    const embed = new EmbedBuilder()
      .setColor(colors[infraction.type])
      .setTitle(`${icons[infraction.type]} ${infraction.type}`)
      .addFields(
        { name: "Utilisateur", value: `<@${infraction.userId}>`, inline: true },
        { name: "Modérateur", value: `<@${infraction.moderatorId}>`, inline: true },
        { name: "Raison", value: infraction.reason },
        { name: "ID Infraction", value: infraction.id, inline: true }
      )
      .setTimestamp(infraction.timestamp)
      .setFooter({ text: `Guild: ${infraction.guildId}` });

    if (member) {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    if (infraction.expiresAt) {
      embed.addFields({
        name: "Expire",
        value: `<t:${Math.floor(infraction.expiresAt.getTime() / 1000)}:R>`,
      });
    }

    await channel.send({ embeds: [embed] });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  clearExpiredInfractions(): number {
    return InfractionModel.clearExpired();
  }
}

export default ModerationService.getInstance();
