import {
  Message,
  GuildMember,
  TextChannel,
  Collection,
  PermissionFlagsBits,
} from "discord.js";
import ModerationService from "./ModerationService";
import { LoggerService } from "./LoggerService";
import { config } from "../config";

interface SpamTracker {
  messages: Collection<string, Message>;
  warnings: number;
  lastWarningTime: number;
}

interface LinkPattern {
  pattern: RegExp;
  name: string;
}

export class AutoModerationService {
  private static instance: AutoModerationService;
  private spamTrackers: Map<string, SpamTracker> = new Map();

  private maxMessagesPerInterval: number = 5;
  private spamInterval: number = 5000;
  private maxDuplicateMessages: number = 3;

  private bannedWords: Set<string> = new Set();
  private suspiciousLinks: LinkPattern[] = [
    { pattern: /discord\.gg\/[a-zA-Z0-9]+/gi, name: "Invitation Discord" },
    { pattern: /discord\.com\/invite\/[a-zA-Z0-9]+/gi, name: "Invitation Discord" },
    { pattern: /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi, name: "Invitation Discord" },
  ];

  private capsThreshold: number = 0.7;
  private capsMinLength: number = 10;

  private mentionLimit: number = 5;

  private enabled: boolean = true;
  private whitelistedRoles: Set<string> = new Set();
  private whitelistedChannels: Set<string> = new Set();

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): AutoModerationService {
    if (!AutoModerationService.instance) {
      AutoModerationService.instance = new AutoModerationService();
    }
    return AutoModerationService.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    LoggerService.info(`AutoMod ${enabled ? "activé" : "désactivé"}`);
  }

  addBannedWord(word: string): void {
    this.bannedWords.add(word.toLowerCase());
  }

  removeBannedWord(word: string): void {
    this.bannedWords.delete(word.toLowerCase());
  }

  addWhitelistedRole(roleId: string): void {
    this.whitelistedRoles.add(roleId);
  }

  addWhitelistedChannel(channelId: string): void {
    this.whitelistedChannels.add(channelId);
  }

  setSpamLimits(maxMessages: number, interval: number): void {
    this.maxMessagesPerInterval = maxMessages;
    this.spamInterval = interval;
  }

  async checkMessage(message: Message): Promise<boolean> {
    if (!this.enabled || !message.guild || message.author.bot) {
      return true;
    }

    const member = message.member;
    if (!member) return true;

    if (this.isWhitelisted(member, message.channel.id)) {
      return true;
    }

    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return true;
    }

    let violations: string[] = [];

    if (this.checkBannedWords(message.content)) {
      violations.push("Mots interdits détectés");
    }

    if (this.checkSuspiciousLinks(message.content)) {
      violations.push("Lien suspect détecté");
    }

    if (this.checkExcessiveCaps(message.content)) {
      violations.push("Abus de majuscules");
    }

    if (this.checkExcessiveMentions(message)) {
      violations.push("Trop de mentions");
    }

    const isSpam = await this.checkSpam(message);
    if (isSpam) {
      violations.push("Spam détecté");
    }

    if (violations.length > 0) {
      await this.handleViolation(message, member, violations);
      return false;
    }

    this.trackMessage(message);
    return true;
  }

  private isWhitelisted(member: GuildMember, channelId: string): boolean {
    if (this.whitelistedChannels.has(channelId)) {
      return true;
    }

    return member.roles.cache.some((role) => this.whitelistedRoles.has(role.id));
  }

  private checkBannedWords(content: string): boolean {
    const lowerContent = content.toLowerCase();
    for (const word of this.bannedWords) {
      if (lowerContent.includes(word)) {
        return true;
      }
    }
    return false;
  }

  private checkSuspiciousLinks(content: string): boolean {
    for (const link of this.suspiciousLinks) {
      if (link.pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  private checkExcessiveCaps(content: string): boolean {
    if (content.length < this.capsMinLength) {
      return false;
    }

    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (letters.length === 0) return false;

    const caps = content.replace(/[^A-Z]/g, "");
    const ratio = caps.length / letters.length;

    return ratio > this.capsThreshold;
  }

  private checkExcessiveMentions(message: Message): boolean {
    const totalMentions =
      message.mentions.users.size +
      message.mentions.roles.size;

    return totalMentions > this.mentionLimit;
  }

  private async checkSpam(message: Message): Promise<boolean> {
    const userId = message.author.id;
    const tracker = this.getOrCreateTracker(userId);

    const now = Date.now();
    const recentMessages = tracker.messages.filter(
      (msg) => now - msg.createdTimestamp < this.spamInterval
    );

    tracker.messages = recentMessages;

    if (recentMessages.size >= this.maxMessagesPerInterval) {
      return true;
    }

    const duplicates = recentMessages.filter(
      (msg) => msg.content === message.content && msg.content.trim() !== ""
    );

    if (duplicates.size >= this.maxDuplicateMessages - 1) {
      return true;
    }

    return false;
  }

  private trackMessage(message: Message): void {
    const tracker = this.getOrCreateTracker(message.author.id);
    tracker.messages.set(message.id, message);
  }

  private getOrCreateTracker(userId: string): SpamTracker {
    if (!this.spamTrackers.has(userId)) {
      this.spamTrackers.set(userId, {
        messages: new Collection(),
        warnings: 0,
        lastWarningTime: 0,
      });
    }
    return this.spamTrackers.get(userId)!;
  }

  private async handleViolation(
    message: Message,
    member: GuildMember,
    violations: string[]
  ): Promise<void> {
    try {
      await message.delete();
    } catch (error) {
      await LoggerService.error(
        `Impossible de supprimer le message de ${member.user.tag}: ${error}`
      );
    }

    const tracker = this.getOrCreateTracker(member.id);
    tracker.warnings++;

    const violationText = violations.join(", ");
    await LoggerService.warning(
      `🛡️ AutoMod: ${member.user.tag} - ${violationText} (${tracker.warnings} avertissement(s))`
    );

    if (tracker.warnings === 1) {
      try {
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await (message.channel as TextChannel).send(
            `${member}, votre message a été supprimé: ${violationText}. Veuillez respecter les règles du serveur.`
          );
        }
      } catch (error) {
        await LoggerService.error(`Impossible d'envoyer un message dans le canal`);
      }
    } else if (tracker.warnings === 3) {
      await ModerationService.warnUser(
        member,
        message.client.user!,
        `AutoMod: Violations répétées (${violationText})`
      );
    } else if (tracker.warnings === 5) {
      await ModerationService.timeoutUser(
        member,
        message.client.user!,
        10 * 60 * 1000,
        `AutoMod: Violations multiples (${violationText})`
      );
    } else if (tracker.warnings >= 7) {
      await ModerationService.kickUser(
        member,
        message.client.user!,
        `AutoMod: Violations persistantes (${violationText})`
      );
    }

    if (config.modLogChannelId && message.guild) {
      try {
        const logChannel = await message.guild.channels.fetch(config.modLogChannelId);
        if (logChannel?.isTextBased()) {
          await (logChannel as TextChannel).send(
            `🛡️ **AutoMod** | ${member} | ${violationText} | Avertissements: ${tracker.warnings}`
          );
        }
      } catch (error) {
        await LoggerService.error(`Impossible d'envoyer dans le canal de logs`);
      }
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const cleanupThreshold = 60 * 60 * 1000;

      for (const [userId, tracker] of this.spamTrackers.entries()) {
        tracker.messages = tracker.messages.filter(
          (msg) => now - msg.createdTimestamp < this.spamInterval
        );

        if (
          tracker.messages.size === 0 &&
          now - tracker.lastWarningTime > cleanupThreshold
        ) {
          this.spamTrackers.delete(userId);
        }
      }
    }, 5 * 60 * 1000);
  }

  resetUserTracker(userId: string): void {
    this.spamTrackers.delete(userId);
  }

  getStats(): {
    trackedUsers: number;
    totalMessages: number;
    bannedWords: number;
  } {
    let totalMessages = 0;
    for (const tracker of this.spamTrackers.values()) {
      totalMessages += tracker.messages.size;
    }

    return {
      trackedUsers: this.spamTrackers.size,
      totalMessages,
      bannedWords: this.bannedWords.size,
    };
  }
}

export default AutoModerationService.getInstance();
