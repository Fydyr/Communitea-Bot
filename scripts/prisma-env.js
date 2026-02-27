// Script pour construire DATABASE_URL à partir des variables séparées et lancer Prisma
require("dotenv").config();

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const dbName = process.env.DB_NAME || "discord_bot";
const dbUser = process.env.DB_USER || "user";
const dbPassword = process.env.DB_PASSWORD || "password";

// Encoder le mot de passe pour gérer les caractères spéciaux
const encodedPassword = encodeURIComponent(dbPassword);

process.env.DATABASE_URL = `postgresql://${dbUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}?schema=public`;

// Lancer la commande Prisma passée en argument
const { execSync } = require("child_process");
const args = process.argv.slice(2).join(" ");

try {
  execSync(`npx prisma ${args}`, {
    stdio: "inherit",
    env: process.env
  });
} catch (error) {
  process.exit(error.status || 1);
}
