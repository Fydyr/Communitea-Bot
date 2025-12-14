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
  botGuilds: config.guildId ? [config.guildId] : undefined,
});

bot.once("clientReady", async () => {
  await bot.clearApplicationCommands();
  await bot.initApplicationCommands();
  console.log(`Bot ${bot.user?.tag} is ready!`);

  // Envoyer un message dans le channel de status
  try {
    await LoggerService.success(`Bot ${bot.user?.tag} démarré et prêt !`);
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de démarrage:", error);
  }

  // Planifier l'envoi quotidien d'anecdotes (tous les jours à 10h00)
  cron.schedule("0 10 * * *", async () => {
    await LoggerService.info("🕐 Envoi de l'anecdote quotidienne (10h)...");
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

  await LoggerService.info("📅 Planificateur d'anecdotes quotidiennes activé (10h00 et 20h00 chaque jour)");
});

bot.on("interactionCreate", (interaction) => {
  bot.executeInteraction(interaction);
});

async function run() {
  // Import all controllers
  const controllersPath = path.join(__dirname, "controllers", "**", "*.js").replace(/\\/g, "/");
  const files = globSync(controllersPath);

  for (const file of files) {
    require(file);
  }

  if (!config.token) {
    throw new Error("DISCORD_TOKEN is not set in .env file");
  }

  await bot.login(config.token);
}

run(); 