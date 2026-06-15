import {
  TextChannel,
  NewsChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
} from "discord.js";
import { bot } from "../index";
import { prisma } from "../lib/prisma";
import { GuildSettingsService, type Language } from "./GuildSettingsService";
import { AnecdoteService } from "./AnecdoteService";
import { GeminiService, type QuizData } from "./GeminiService";
import { LoggerService } from "./LoggerService";
import { t } from "../i18n";

const COLLECTOR_MS = 120_000;

export class QuizService {
  /** Génère un quiz pour un serveur (langue + thèmes pris en compte). */
  public static async generateForGuild(guildId: string): Promise<{ quiz: QuizData; lang: Language } | null> {
    const settings = await GuildSettingsService.get(guildId);
    const themesContext = AnecdoteService.buildThemesContext(settings.themes);
    const quiz = await GeminiService.generateQuiz(settings.language, themesContext);
    if (!quiz) {
      return null;
    }
    return { quiz, lang: settings.language };
  }

  /** Embed + boutons (actifs) pour un quiz. */
  public static buildMessage(quiz: QuizData, lang: Language): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
  } {
    const embed = new EmbedBuilder()
      .setTitle(t(lang, "quiz.title"))
      .setColor(0x5865F2)
      .setDescription(quiz.question)
      .setFooter({ text: t(lang, "quiz.footer") })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      quiz.options.map((option, index) =>
        new ButtonBuilder()
          .setCustomId(`quiz_${index}`)
          .setLabel(option.slice(0, 80))
          .setStyle(ButtonStyle.Primary)
      )
    );

    return { embeds: [embed], components: [row] };
  }

  /** Boutons désactivés, la bonne réponse mise en vert (fin de quiz). */
  private static disabledComponents(quiz: QuizData): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      quiz.options.map((option, index) =>
        new ButtonBuilder()
          .setCustomId(`quiz_${index}`)
          .setLabel(option.slice(0, 80))
          .setStyle(index === quiz.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(true)
      )
    );
    return [row];
  }

  /**
   * Attache un collector de boutons : feedback éphémère par utilisateur, puis
   * révélation de la bonne réponse à la fin.
   */
  public static attachCollector(message: Message, quiz: QuizData, lang: Language): void {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (interaction) => {
      try {
        const index = parseInt(interaction.customId.split("_")[1] ?? "-1", 10);
        const answer = quiz.options[quiz.correctIndex];
        if (index === quiz.correctIndex) {
          await interaction.reply({ content: t(lang, "quiz.correct", { explanation: quiz.explanation }), flags: 64 });
        } else {
          await interaction.reply({ content: t(lang, "quiz.incorrect", { answer, explanation: quiz.explanation }), flags: 64 });
        }
      } catch (error) {
        await LoggerService.error(`Erreur lors d'une réponse au quiz: ${error}`);
      }
    });

    collector.on("end", async () => {
      try {
        const base = message.embeds[0]
          ? EmbedBuilder.from(message.embeds[0])
          : new EmbedBuilder().setTitle(t(lang, "quiz.title"));
        base.addFields({ name: "​", value: t(lang, "quiz.reveal", { answer: quiz.options[quiz.correctIndex] }) });
        await message.edit({ embeds: [base], components: this.disabledComponents(quiz) });
      } catch {
        // message supprimé ou non éditable : on ignore
      }
    });
  }

  /** Envoie un quiz dans un salon donné et attache le collector. */
  public static async sendToChannel(channel: TextChannel | NewsChannel, guildId: string): Promise<boolean> {
    const generated = await this.generateForGuild(guildId);
    if (!generated) {
      return false;
    }

    const { embeds, components } = this.buildMessage(generated.quiz, generated.lang);
    const message = await channel.send({ embeds, components });
    this.attachCollector(message, generated.quiz, generated.lang);
    return true;
  }

  /**
   * Évalue les quiz programmés : pour chaque serveur dont une heure de quiz
   * correspond à l'heure courante (dans son fuseau), envoie un quiz dans chacun
   * de ses salons d'anecdotes. Appelé par le cron horaire.
   */
  public static async sendScheduledQuizzes(): Promise<void> {
    try {
      const guilds = await prisma.anecdoteChannel.findMany({
        distinct: ["guildId"],
        select: { guildId: true },
      });

      for (const { guildId } of guilds) {
        try {
          const settings = await GuildSettingsService.get(guildId);
          if (settings.quizHours.length === 0) {
            continue;
          }

          const currentHour = AnecdoteService.getCurrentHourInTimezone(settings.timezone);
          if (!settings.quizHours.includes(currentHour)) {
            continue;
          }

          const channels = await prisma.anecdoteChannel.findMany({ where: { guildId } });
          for (const channelConfig of channels) {
            try {
              const channel = await bot.channels.fetch(channelConfig.channelId);
              if (channel instanceof TextChannel || channel instanceof NewsChannel) {
                await this.sendToChannel(channel, guildId);
              }
            } catch (error) {
              await LoggerService.error(`Erreur envoi quiz au salon ${channelConfig.channelId}: ${error}`);
            }
          }
          await LoggerService.success(`Quiz programmé envoyé au serveur ${guildId} (${currentHour}h)`);
        } catch (error) {
          await LoggerService.error(`Erreur lors du quiz programmé du serveur ${guildId}: ${error}`);
        }
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors de l'évaluation des quiz programmés: ${error}`);
    }
  }
}
