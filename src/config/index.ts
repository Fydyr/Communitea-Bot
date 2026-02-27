import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  statusChannelId: process.env.STATUS_CHANNEL_ID || "",
  logWebhookUrl: process.env.LOG_WEBHOOK_URL || "",
};
