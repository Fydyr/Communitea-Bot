import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  guildId: process.env.DISCORD_GUILD_ID || "",
  clientId: process.env.CLIENT_ID || "",
  weatherApiKey: process.env.WEATHER_API_KEY || "",
};
