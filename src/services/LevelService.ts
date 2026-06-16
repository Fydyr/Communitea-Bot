import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const XP_VOTE = 5;
export const XP_QUIZ = 10;
export const XP_QUIZ_CORRECT_BONUS = 15;

export type XpSource = "vote" | "quiz";

export interface AwardResult {
  leveledUp: boolean;
  level: number;
  xp: number;
}

export interface StatsEntry {
  userId: string;
  xp: number;
  level: number;
  quizAnswered: number;
  quizCorrect: number;
}

export class LevelService {
  /** Niveau atteint pour une quantité d'XP (seuil cumulatif : 100 * niveau²). */
  static levelForXp(xp: number): number {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
  }

  /** XP cumulée nécessaire pour atteindre un niveau donné. */
  static xpForLevel(level: number): number {
    return 100 * level * level;
  }

  /**
   * Attribue de l'XP une seule fois par (utilisateur, source, refId).
   * Renvoie null si l'XP a déjà été attribuée pour cette référence.
   */
  static async award(
    guildId: string,
    userId: string,
    source: XpSource,
    refId: string,
    options: { correct?: boolean } = {}
  ): Promise<AwardResult | null> {
    const amount =
      source === "quiz" ? XP_QUIZ + (options.correct ? XP_QUIZ_CORRECT_BONUS : 0) : XP_VOTE;

    try {
      await prisma.xpEvent.create({ data: { guildId, userId, source, refId, amount } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null; // déjà attribué
      }
      throw error;
    }

    const stats = await prisma.userStats.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        xp: amount,
        level: 0,
        quizAnswered: source === "quiz" ? 1 : 0,
        quizCorrect: source === "quiz" && options.correct ? 1 : 0,
      },
      update: {
        xp: { increment: amount },
        quizAnswered: source === "quiz" ? { increment: 1 } : undefined,
        quizCorrect: source === "quiz" && options.correct ? { increment: 1 } : undefined,
      },
    });

    const newLevel = this.levelForXp(stats.xp);
    const leveledUp = newLevel > stats.level;
    if (newLevel !== stats.level) {
      await prisma.userStats.update({ where: { id: stats.id }, data: { level: newLevel } });
    }

    return { leveledUp, level: newLevel, xp: stats.xp };
  }

  static async getStats(guildId: string, userId: string): Promise<StatsEntry> {
    const row = await prisma.userStats.findUnique({ where: { guildId_userId: { guildId, userId } } });
    if (!row) {
      return { userId, xp: 0, level: 0, quizAnswered: 0, quizCorrect: 0 };
    }
    return {
      userId: row.userId,
      xp: row.xp,
      level: row.level,
      quizAnswered: row.quizAnswered,
      quizCorrect: row.quizCorrect,
    };
  }

  static async xpLeaderboard(guildId: string, limit = 10): Promise<StatsEntry[]> {
    const rows = await prisma.userStats.findMany({
      where: { guildId },
      orderBy: { xp: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      userId: r.userId,
      xp: r.xp,
      level: r.level,
      quizAnswered: r.quizAnswered,
      quizCorrect: r.quizCorrect,
    }));
  }

  static async quizLeaderboard(guildId: string, limit = 10): Promise<StatsEntry[]> {
    const rows = await prisma.userStats.findMany({
      where: { guildId, quizCorrect: { gt: 0 } },
      orderBy: [{ quizCorrect: "desc" }, { quizAnswered: "asc" }],
      take: limit,
    });
    return rows.map((r) => ({
      userId: r.userId,
      xp: r.xp,
      level: r.level,
      quizAnswered: r.quizAnswered,
      quizCorrect: r.quizCorrect,
    }));
  }
}
