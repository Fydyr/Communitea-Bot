import "reflect-metadata";
import { IntentsBitField, Partials } from "discord.js";
import { Client } from "discordx";
import { config } from "./config";
import path from "path";
import { globSync } from "glob";
import cron from "node-cron";
import { AnecdoteService } from "./services/AnecdoteService";
import { QuizService } from "./services/QuizService";
import { NewsService } from "./services/NewsService";
import { LoggerService } from "./services/LoggerService";
import { registerReactionListeners } from "./listeners/reactions";

export const bot = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
  // Partials nécessaires pour recevoir les réactions sur des messages non mis en cache.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  silent: false,
});

registerReactionListeners(bot);

bot.once("clientReady", async () => {
  await bot.clearApplicationCommands();
  await bot.initApplicationCommands();
  await LoggerService.success(`Bot ${bot.user?.tag} démarré et prêt !`);

  // Un seul cron horaire : à chaque heure pleine, on évalue pour chaque
  // serveur si l'heure courante (dans son fuseau) fait partie de ses heures
  // d'envoi configurées. Les horaires/fuseaux sont définis par serveur.
  cron.schedule("0 * * * *", async () => {
    await AnecdoteService.sendScheduledAnecdotes();
    await QuizService.sendScheduledQuizzes();
    await AnecdoteService.sendWeeklyRecaps();
  }, { timezone: "UTC" });

  await LoggerService.info("📅 Planificateur d'anecdotes et de quiz activé (horaires et fuseaux configurables par serveur)");

  // Cron dédié aux news : toutes les demi-heures, pour supporter le retry à
  // 30 minutes sans toucher au rythme horaire des anecdotes et des quiz.
  // `noOverlap: true` : si un tick dépasse 30 minutes (plausible quand le
  // nombre de serveurs grandit, les envois étant séquentiels), node-cron
  // n'en démarre pas un second par-dessus — deux ticks concurrents sur le
  // même créneau "pending" l'enverraient tous les deux.
  cron.schedule("*/30 * * * *", async () => {
    await NewsService.tick();
  }, { timezone: "UTC", noOverlap: true });

  await LoggerService.info("Planificateur de news activé (toutes les 30 minutes, horaires configurables par serveur)");
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

// Ne démarre le bot que lorsque ce fichier est exécuté directement
// (node dist/index.js) et non lorsqu'il est importé (ex. par les tests).
if (require.main === module) {
  run();
}
