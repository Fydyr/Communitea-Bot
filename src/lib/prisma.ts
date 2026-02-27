import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

// Construire DATABASE_URL à partir des variables séparées
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const dbName = process.env.DB_NAME || "discord_bot";
const dbUser = process.env.DB_USER || "user";
const dbPassword = process.env.DB_PASSWORD || "password";

// Encoder le mot de passe pour gérer les caractères spéciaux (@, #, etc.)
const encodedPassword = encodeURIComponent(dbPassword);

process.env.DATABASE_URL = `postgresql://${dbUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}?schema=public`;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
