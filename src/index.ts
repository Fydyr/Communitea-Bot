import "reflect-metadata";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { config } from "./config";
import path from "path";
import { globSync } from "glob";
import cron from "node-cron";
import { AnecdoteService } from "./services/AnecdoteService";
import { LoggerService } from "./services/LoggerService";
import AutoModerationService from "./services/AutoModerationService";
import ModerationService from "./services/ModerationService";

export const bot = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
  silent: false,
  botGuilds: config.guildId ? [config.guildId] : undefined,
});

bot.once("clientReady", async () => {
  await bot.clearApplicationCommands();
  await bot.initApplicationCommands();
  await LoggerService.success(`Bot ${bot.user?.tag} démarré et prêt !`);

  // Envoyer un message dans le channel de status
  try {
    await LoggerService.success(`Bot ${bot.user?.tag} initialisé avec succès !`);
  } catch (error) {
    await LoggerService.error(`Erreur lors de l'envoi du message de démarrage: ${error}`);
  }

  // Configurer les services de modération
  ModerationService.setMaxWarnings(config.maxWarningsBeforeKick, config.maxWarningsBeforeBan);
  AutoModerationService.setEnabled(config.autoModEnabled);
  await LoggerService.info(`🛡️ Système de modération initialisé (AutoMod: ${config.autoModEnabled ? "activé" : "désactivé"})`);

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 10h00)
  cron.schedule("0 10 * * *", async () => {
    await LoggerService.info("🕐 Envoi de l'anecdote quotidienne (10h)...");
    await AnecdoteService.sendDailyAnecdote();
  }, {
    timezone: "Europe/Paris"
  });

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 15h00)
  cron.schedule("0 15 * * *", async () => {
    await LoggerService.info("🕐 Envoi de l'anecdote quotidienne (15h)...");
    await AnecdoteService.sendDailyAnecdote();
  }, {
    timezone: "Europe/Paris"
  });

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 20h00)
  cron.schedule("0 20 * * *", async () => {
    await LoggerService.info("🕐 Envoi de l'anecdote quotidienne (20h)...");
    await AnecdoteService.sendDailyAnecdote();
  }, {
    timezone: "Europe/Paris"
  });

  await LoggerService.info("📅 Planificateur d'anecdotes quotidiennes activé (10h00, 15h00 et 20h00 chaque jour)");

  // Nettoyage périodique des infractions expirées
  cron.schedule("0 * * * *", () => {
    const cleared = ModerationService.clearExpiredInfractions();
    if (cleared > 0) {
      LoggerService.info(`🧹 ${cleared} infraction(s) expirée(s) nettoyée(s)`);
    }
  });
});

bot.on("interactionCreate", (interaction) => {
  bot.executeInteraction(interaction);
});

bot.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  await AutoModerationService.checkMessage(message);
});

async function run() {
  try {
    await LoggerService.info("🚀 Démarrage du bot Discord...");

    // Import all controllers
    const controllersPath = path.join(__dirname, "controllers", "**", "*.js").replace(/\\/g, "/");
    const files = globSync(controllersPath);

    await LoggerService.info(`📂 Chargement de ${files.length} contrôleur(s)...`);

    for (const file of files) {
      require(file);
    }

    if (!config.token) {
      throw new Error("DISCORD_TOKEN is not set in .env file");
    }

    await bot.login(config.token);
    await LoggerService.info("✅ Connexion au bot Discord établie");
  } catch (error) {
    await LoggerService.error(`❌ Erreur fatale lors du démarrage du bot: ${error}`);
    process.exit(1);
  }
}

// Gestion globale des erreurs non capturées
process.on("uncaughtException", async (error: Error) => {
  await LoggerService.error(`💥 Exception non capturée: ${error.message}\nStack: ${error.stack}`);
  process.exit(1);
});

process.on("unhandledRejection", async (reason: any) => {
  await LoggerService.error(`⚠️ Promesse rejetée non gérée: ${reason}`);
});

// Gestion de l'arrêt propre du bot
process.on("SIGINT", async () => {
  await LoggerService.warning("🛑 Arrêt du bot demandé (SIGINT)");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await LoggerService.warning("🛑 Arrêt du bot demandé (SIGTERM)");
  process.exit(0);
});

run(); 