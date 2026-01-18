import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  guildId: process.env.DISCORD_GUILD_ID || "",
  statusChannelId: process.env.STATUS_CHANNEL_ID || "",
  anecdoteChannelId: process.env.ANECDOTE_CHANNEL_ID || "",
  logWebhookUrl: process.env.LOG_WEBHOOK_URL || "",
};
