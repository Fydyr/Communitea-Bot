import "reflect-metadata";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { config } from "./config";
import path from "path";
import { globSync } from "glob";
import cron from "node-cron";
import { AnecdoteService } from "./services/AnecdoteService";
import { LoggerService } from "./services/LoggerService";

export const bot = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
  silent: false,
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

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 8h00)
  cron.schedule("0 8 * * *", async () => {
    await LoggerService.info("🕐 Envoi des anecdotes quotidiennes (8h)...");
    await AnecdoteService.sendDailyAnecdotes();
  }, {
    timezone: "Europe/Paris"
  });

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 20h00)
  cron.schedule("0 20 * * *", async () => {
    await LoggerService.info("🕐 Envoi des anecdotes quotidiennes (20h)...");
    await AnecdoteService.sendDailyAnecdotes();
  }, {
    timezone: "Europe/Paris"
  });

  await LoggerService.info("📅 Planificateur d'anecdotes quotidiennes activé (8h00 et 20h00 chaque jour)");
});

bot.on("interactionCreate", async (interaction) => {
  try {
    await bot.executeInteraction(interaction);
  } catch (error: any) {
    // Ignorer les erreurs d'interaction inconnue (timeout Discord)
    if (error?.code === 10062 || error?.message?.includes("Unknown interaction")) {
      await LoggerService.warning(`Interaction expirée ou invalide (probablement un timeout)`);
      return;
    }
    await LoggerService.error(`Erreur lors de l'exécution de l'interaction: ${error}`);
  }
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
  // Ignorer les erreurs d'interaction Discord connues
  if (reason?.code === 10062 || reason?.message?.includes("Unknown interaction")) {
    await LoggerService.warning(`Interaction Discord expirée (timeout) - Ignoré`);
    return;
  }
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