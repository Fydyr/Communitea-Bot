import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/prisma";

describe("Schéma des news", () => {
  it("interdit deux salons news identiques sur un même serveur", async () => {
    await prisma.newsChannel.create({ data: { guildId: "g1", channelId: "c1" } });

    await expect(
      prisma.newsChannel.create({ data: { guildId: "g1", channelId: "c1" } })
    ).rejects.toThrow();
  });

  it("interdit deux créneaux identiques (serveur, date, heure)", async () => {
    await prisma.newsRun.create({ data: { guildId: "g1", runDate: "2026-08-04", slotHour: 8 } });

    await expect(
      prisma.newsRun.create({ data: { guildId: "g1", runDate: "2026-08-04", slotHour: 8 } })
    ).rejects.toThrow();
  });

  it("autorise le même créneau sur deux serveurs différents", async () => {
    await prisma.newsRun.create({ data: { guildId: "g1", runDate: "2026-08-04", slotHour: 8 } });
    const second = await prisma.newsRun.create({
      data: { guildId: "g2", runDate: "2026-08-04", slotHour: 8 },
    });

    expect(second.status).toBe("pending");
    expect(second.attempts).toBe(0);
    expect(second.nextAttemptAt).toBeNull();
  });
});
