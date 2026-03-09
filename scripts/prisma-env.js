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

// Whitelist des commandes Prisma autorisées
const ALLOWED_COMMANDS = [
  ["generate"],
  ["db", "push"],
  ["db", "pull"],
  ["migrate", "dev"],
  ["migrate", "deploy"],
  ["migrate", "reset"],
  ["studio"],
];

const args = process.argv.slice(2);
const isAllowed = ALLOWED_COMMANDS.some(
  (cmd) => cmd.length === args.length && cmd.every((part, i) => part === args[i])
);

if (!isAllowed) {
  console.error(`Commande Prisma non autorisée: prisma ${args.join(" ")}`);
  process.exit(1);
}

// Lancer la commande Prisma avec les arguments validés
const { spawnSync } = require("child_process");
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
