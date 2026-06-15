import { Client } from "discordx";
import { EmbedBuilder, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { FLAG_TO_LANGUAGE } from "../services/flagLanguages";
import { TranslationService } from "../services/TranslationService";
import { GuildSettingsService, DEFAULT_LANGUAGE, type Language } from "../services/GuildSettingsService";
import { t } from "../i18n";
import { LoggerService } from "../services/LoggerService";

// Couples (messageId, langue) déjà traduits, pour éviter de reposter.
const translatedCache = new Set<string>();

/** Garantit que la réaction est chargée (gestion des partials). */
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
 * Enregistre les listeners de réactions : un drapeau déclenche la traduction
 * automatique du message. (Les votes d'anecdotes utilisent des boutons.)
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

      await handleTranslation(full, full.emoji.name ?? "");
    } catch (error) {
      await LoggerService.error(`Erreur lors du traitement d'une réaction: ${error}`);
    }
  });
}
