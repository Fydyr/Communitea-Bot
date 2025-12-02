import "reflect-metadata";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { config } from "./config";
import path from "path";
import { globSync } from "glob";

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

bot.once("ready", async () => {
  await bot.clearApplicationCommands();
  await bot.initApplicationCommands();
  console.log(`Bot ${bot.user?.tag} is ready!`);

  // Envoyer un message dans le channel de status
  try {
    const channel = await bot.channels.fetch(config.statusChannelId);
    if (channel && "send" in channel) {
      await channel.send("🟢 Bot démarré et prêt !");
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de démarrage:", error);
  }
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
