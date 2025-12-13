import axios from "axios";
import { config } from "../config";
import { bot } from "../index";
import { TextChannel } from "discord.js";

export enum LogLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

export class LoggerService {
  private static readonly EMOJI_MAP = {
    [LogLevel.INFO]: "ℹ️",
    [LogLevel.SUCCESS]: "✅",
    [LogLevel.WARNING]: "⚠️",
    [LogLevel.ERROR]: "❌",
  };

  private static readonly COLOR_MAP = {
    [LogLevel.INFO]: 0x3498db, // Bleu
    [LogLevel.SUCCESS]: 0x2ecc71, // Vert
    [LogLevel.WARNING]: 0xf39c12, // Orange
    [LogLevel.ERROR]: 0xe74c3c, // Rouge
  };

  /**
   * Envoie un log vers Discord
   */
  public static async log(message: string, level: LogLevel = LogLevel.INFO): Promise<void> {
    const timestamp = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "medium",
    });

    const emoji = this.EMOJI_MAP[level];
    const formattedMessage = `${emoji} **[${level}]** ${message}`;

    // Toujours afficher dans la console
    console.log(`[${timestamp}] ${formattedMessage}`);

    // Essayer d'envoyer via webhook en priorité
    if (config.logWebhookUrl) {
      try {
        await this.sendViaWebhook(message, level, timestamp);
        return;
      } catch (error) {
        console.error("Erreur lors de l'envoi via webhook, tentative via channel...", error);
      }
    }

    // Sinon, essayer d'envoyer via le channel
    if (config.statusChannelId) {
      try {
        await this.sendViaChannel(formattedMessage);
      } catch (error) {
        console.error("Erreur lors de l'envoi du log vers Discord:", error);
      }
    }
  }

  private static async sendViaWebhook(message: string, level: LogLevel, timestamp: string): Promise<void> {
    const emoji = this.EMOJI_MAP[level];
    const color = this.COLOR_MAP[level];

    await axios.post(config.logWebhookUrl, {
      embeds: [
        {
          description: message,
          color: color,
          footer: {
            text: `${emoji} ${level} • ${timestamp}`,
          },
        },
      ],
    });
  }

  private static async sendViaChannel(message: string): Promise<void> {
    const channel = await bot.channels.fetch(config.statusChannelId);

    if (channel && channel instanceof TextChannel) {
      await channel.send(message);
    }
  }

  // Méthodes de raccourci
  public static info(message: string): Promise<void> {
    return this.log(message, LogLevel.INFO);
  }

  public static success(message: string): Promise<void> {
    return this.log(message, LogLevel.SUCCESS);
  }

  public static warning(message: string): Promise<void> {
    return this.log(message, LogLevel.WARNING);
  }

  public static error(message: string): Promise<void> {
    return this.log(message, LogLevel.ERROR);
  }
}
