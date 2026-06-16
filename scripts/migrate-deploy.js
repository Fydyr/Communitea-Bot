// Applique les migrations en production. Si une migration est marquée comme
// échouée (P3009), elle est résolue en "rolled-back" puis le déploiement est
// relancé. Les migrations sont idempotentes, donc une réapplication est sûre.
require("dotenv").config();
const { spawnSync } = require("child_process");

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const dbName = process.env.DB_NAME || "discord_bot";
const dbUser = process.env.DB_USER || "user";
const dbPassword = process.env.DB_PASSWORD || "password";

process.env.DATABASE_URL = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=public`;

const isWin = process.platform === "win32";

function prisma(args, capture) {
  return spawnSync("npx", ["prisma", ...args], {
    env: process.env,
    shell: isWin,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf-8",
  });
}

const MAX_ATTEMPTS = 5;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const result = prisma(["migrate", "deploy"], true);
  const output = (result.stdout || "") + (result.stderr || "");
  process.stdout.write(output);

  if (result.status === 0) {
    process.exit(0);
  }

  const failed = [
    ...new Set(
      [...output.matchAll(/The `([^`]+)` migration started [^\n]*failed/g)].map((m) => m[1])
    ),
  ];

  if (failed.length === 0) {
    process.exit(result.status ?? 1);
  }

  for (const name of failed) {
    console.log(`Migration échouée détectée, résolution (rolled-back): ${name}`);
    prisma(["migrate", "resolve", "--rolled-back", name], false);
  }
}

console.error("Échec du déploiement des migrations après plusieurs tentatives.");
process.exit(1);
