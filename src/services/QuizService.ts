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
import { LevelService } from "./LevelService";
import { LoggerService } from "./LoggerService";
import { t } from "../i18n";

const COLLECTOR_MS = 60_000;
/** Durée du collecteur pour les quiz automatiques (programmés) : 5 minutes. */
const AUTO_COLLECTOR_MS = 5 * 60_000;
const OPTION_LETTERS = ["A", "B", "C", "D"];

export class QuizService {
  /** Génère un quiz dans une langue donnée (thèmes optionnels). */
  public static async generate(language: Language, themesContext = "", guildId?: string): Promise<{ quiz: QuizData; lang: Language } | null> {
    const quiz = await GeminiService.generateQuiz(language, themesContext, guildId);
    if (!quiz) {
      return null;
    }
    return { quiz, lang: language };
  }

  /** Génère un quiz pour un serveur (langue + thèmes + mémoire pris en compte). */
  public static async generateForGuild(guildId: string): Promise<{ quiz: QuizData; lang: Language } | null> {
    const settings = await GuildSettingsService.get(guildId);
    return this.generate(settings.language, AnecdoteService.buildThemesContext(settings.themes), guildId);
  }

  /**
   * Mémorise la question d'un quiz envoyée sur un serveur, pour éviter de la
   * répéter lors des prochaines générations (filtré côté Gemini).
   */
  public static async saveSentQuiz(guildId: string, question: string): Promise<void> {
    try {
      await prisma.sentQuiz.create({ data: { guildId, question: question.trim() } });
    } catch (error) {
      await LoggerService.error(`Erreur lors de la sauvegarde du quiz pour le serveur ${guildId}: ${error}`);
    }
  }

  /** Embed + boutons (actifs) pour un quiz. */
  public static buildMessage(quiz: QuizData, lang: Language): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
  } {
    // Les réponses sont listées dans l'embed (A/B/C/D) ; les boutons ne portent
    // que la lettre, pour éviter la troncature des libellés (max ~80 caractères).
    const optionsText = quiz.options
      .map((option, index) => `**${OPTION_LETTERS[index]}.** ${option}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(t(lang, "quiz.title"))
      .setColor(0x5865F2)
      .setDescription(`${quiz.question}\n\n${optionsText}`)
      .setFooter({ text: t(lang, "quiz.footer") })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      quiz.options.map((_option, index) =>
        new ButtonBuilder()
          .setCustomId(`quiz_${index}`)
          .setLabel(OPTION_LETTERS[index])
          .setStyle(ButtonStyle.Primary)
      )
    );

    return { embeds: [embed], components: [row] };
  }

  /** Boutons désactivés, la bonne réponse mise en vert (fin de quiz). */
  private static disabledComponents(quiz: QuizData): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      quiz.options.map((_option, index) =>
        new ButtonBuilder()
          .setCustomId(`quiz_${index}`)
          .setLabel(OPTION_LETTERS[index])
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
  public static attachCollector(message: Message, quiz: QuizData, lang: Language, collectorMs: number = COLLECTOR_MS): void {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: collectorMs,
    });

    collector.on("collect", async (interaction) => {
      try {
        const index = parseInt(interaction.customId.split("_")[1] ?? "-1", 10);
        const answer = quiz.options[quiz.correctIndex];
        const correct = index === quiz.correctIndex;

        if (correct) {
          await interaction.reply({ content: t(lang, "quiz.correct", { explanation: quiz.explanation }), flags: 64 });
        } else {
          await interaction.reply({ content: t(lang, "quiz.incorrect", { answer, explanation: quiz.explanation }), flags: 64 });
        }

        if (message.guildId) {
          const award = await LevelService.award(message.guildId, interaction.user.id, "quiz", message.id, { correct });
          if (award?.leveledUp && message.channel.isTextBased() && !message.channel.isDMBased()) {
            await (message.channel as TextChannel).send(t(lang, "level.up", { user: interaction.user.id, level: award.level }));
          }
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
        const reveal = `${t(lang, "quiz.reveal", { answer: quiz.options[quiz.correctIndex] })}\n${quiz.explanation}`;
        base.addFields({ name: "​", value: reveal.slice(0, 1024) });
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
    // Quiz automatique : collecteur de 5 minutes et mémorisation par serveur.
    this.attachCollector(message, generated.quiz, generated.lang, AUTO_COLLECTOR_MS);
    await this.saveSentQuiz(guildId, generated.quiz.question);
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
