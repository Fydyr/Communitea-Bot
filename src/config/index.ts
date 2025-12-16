import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  guildId: process.env.DISCORD_GUILD_ID || "",
  statusChannelId: process.env.STATUS_CHANNEL_ID || "",
  anecdoteChannelId: process.env.ANECDOTE_CHANNEL_ID || "",
  logWebhookUrl: process.env.LOG_WEBHOOK_URL || "",
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID || "",
  autoModEnabled: process.env.AUTOMOD_ENABLED === "true",
  maxWarningsBeforeKick: parseInt(process.env.MAX_WARNINGS_BEFORE_KICK || "3"),
  maxWarningsBeforeBan: parseInt(process.env.MAX_WARNINGS_BEFORE_BAN || "5"),
};
