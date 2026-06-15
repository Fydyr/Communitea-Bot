import { Client } from "discordx";
import { EmbedBuilder, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { FLAG_TO_LANGUAGE } from "../services/flagLanguages";
import { TranslationService } from "../services/TranslationService";
import { GuildSettingsService, DEFAULT_LANGUAGE, type Language } from "../services/GuildSettingsService";
import { t } from "../i18n";
import { prisma } from "../lib/prisma";
import { LoggerService } from "../services/LoggerService";

// Couples (messageId, langue) déjà traduits, pour éviter de reposter.
const translatedCache = new Set<string>();

const UPVOTE = "👍";
const DOWNVOTE = "👎";

/** Met à jour un compteur de votes d'une anecdote suivie (sans descendre sous 0). */
async function applyVote(messageId: string, field: "upvotes" | "downvotes", delta: number): Promise<void> {
  const row = await prisma.anecdoteMessage.findUnique({ where: { messageId } });
  if (!row) {
    return;
  }
  const next = Math.max(0, row[field] + delta);
  if (next === row[field]) {
    return;
  }
  await prisma.anecdoteMessage.update({ where: { messageId }, data: { [field]: next } });
}

/** Garantit que la réaction et son message sont chargés (gestion des partials). */
async function ensureFetched(reaction: MessageReaction | PartialMessageReaction): Promise<MessageReaction | null> {
  try {
    if (reaction.partial) {
      await reaction.fetch();
    }
    return reaction as MessageReaction;
  } catch {
    return null;
  }
}

async function handleTranslation(reaction: MessageReaction, emoji: string): Promise<void> {
  const target = FLAG_TO_LANGUAGE[emoji];
  if (!target) {
    return;
  }

  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  const content = message.content?.trim();
  if (!content) {
    return;
  }

  const cacheKey = `${message.id}:${target.code}`;
  if (translatedCache.has(cacheKey)) {
    return;
  }
  translatedCache.add(cacheKey);
  if (translatedCache.size > 2000) {
    translatedCache.clear();
  }

  const translated = await TranslationService.translate(content, target);
  if (!translated) {
    return;
  }

  const lang: Language = message.guildId
    ? await GuildSettingsService.getLanguage(message.guildId)
    : DEFAULT_LANGUAGE;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(t(lang, "translate.title", { language: target.name }))
    .setDescription(translated.slice(0, 4096))
    .setFooter({ text: t(lang, "translate.footer") })
    .setTimestamp();

  await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  await LoggerService.info(`Traduction (${target.code}) postée pour le message ${message.id}`);
}

/**
 * Enregistre les listeners de réactions :
 * - drapeau → traduction automatique du message
 * - 👍 / 👎 sur une anecdote suivie → mise à jour des votes
 */
export function registerReactionListeners(bot: Client): void {
  bot.on("messageReactionAdd", async (reaction, user: User | PartialUser) => {
    try {
      if (user.bot) {
        return;
      }

      const full = await ensureFetched(reaction);
      if (!full) {
        return;
      }

      const emoji = full.emoji.name ?? "";

      if (emoji === UPVOTE || emoji === DOWNVOTE) {
        await applyVote(full.message.id, emoji === UPVOTE ? "upvotes" : "downvotes", 1);
        return;
      }

      await handleTranslation(full, emoji);
    } catch (error) {
      await LoggerService.error(`Erreur lors du traitement d'une réaction ajoutée: ${error}`);
    }
  });

  bot.on("messageReactionRemove", async (reaction, user: User | PartialUser) => {
    try {
      if (user.bot) {
        return;
      }

      const full = await ensureFetched(reaction);
      if (!full) {
        return;
      }

      const emoji = full.emoji.name ?? "";
      if (emoji === UPVOTE || emoji === DOWNVOTE) {
        await applyVote(full.message.id, emoji === UPVOTE ? "upvotes" : "downvotes", -1);
      }
    } catch (error) {
      await LoggerService.error(`Erreur lors du traitement d'une réaction retirée: ${error}`);
    }
  });
}
