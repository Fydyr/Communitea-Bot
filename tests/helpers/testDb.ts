import { execSync } from "node:child_process";
import { afterEach } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { PrismaClient } from "@prisma/client";

// Tables à vider entre chaque test (cf. prisma/schema.prisma).
const TABLES = [
  "AnecdoteChannel",
  "SentAnecdote",
  "GuildSettings",
  "AnecdoteMessage",
  "AnecdoteVote",
  "UserStats",
  "XpEvent",
  "SentQuiz",
  "NewsChannel",
  "SentNews",
  "NewsRun",
];

declare global {
  // eslint-disable-next-line no-var
  var __TEST_DB__: { container: StartedPostgreSqlContainer; prisma: PrismaClient } | undefined;
}

// La config Vitest lance l'intégration en `singleFork` : tous les fichiers de
// test tournent dans UN seul process. On démarre donc un unique conteneur
// Postgres pour tout le run, mémorisé sur `globalThis` pour ne pas le recréer à
// chaque fichier (chaque fichier réévalue ce setupFile). Le conteneur est
// nettoyé automatiquement par Testcontainers (Ryuk) à la sortie du process, ce
// qui évite un `afterAll` par fichier qui arrêterait le conteneur — et
// déconnecterait le singleton Prisma partagé — au milieu du run.
//
// Ce bloc doit s'exécuter à l'évaluation du module (top-level await), et non
// dans un hook `beforeAll` : les fichiers de test importent
// `{ prisma } from "../../src/lib/prisma"` en tête de fichier, imports évalués
// pendant la collecte, AVANT tout `beforeAll`. Les variables DB_* et l'import
// de src/lib/prisma doivent donc avoir eu lieu ici, dans le setupFile chargé
// avant le fichier de test.
if (!globalThis.__TEST_DB__) {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("discord_bot_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_NAME = container.getDatabase();
  process.env.DB_USER = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();

  const { prisma } = await import("../../src/lib/prisma");

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  globalThis.__TEST_DB__ = { container, prisma };
}

const { prisma } = globalThis.__TEST_DB__;

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`
  );
});
