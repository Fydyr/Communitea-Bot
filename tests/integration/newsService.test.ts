import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";

const send = vi.fn();

// Le client Discord est remplacé : `channels.fetch` renvoie un faux salon
// textuel dont `send` est espionné.
vi.mock("../../src/index", () => ({
  bot: {
    user: null,
    channels: { fetch: vi.fn(async (id: string) => ({ id, name: `salon-${id}`, send })) },
  },
}));

vi.mock("../../src/services/LoggerService", () => ({
  LoggerService: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const buildDigest = vi.fn();
vi.mock("../../src/services/NewsSourceService", () => ({
  NewsSourceService: { buildDigest: (...args: unknown[]) => buildDigest(...args) },
}));

import { NewsService } from "../../src/services/NewsService";
import { GuildSettingsService } from "../../src/services/GuildSettingsService";
import { localDateInTimezone } from "../../src/services/newsSchedule";

const DIGEST = {
  items: [
    { title: "T1", url: "https://n.test/1", summary: "S1", source: "n.test" },
    { title: "T2", url: "https://n.test/2", summary: "S2", source: "n.test" },
    { title: "T3", url: "https://n.test/3", summary: "S3", source: "n.test" },
  ],
  tier: "rss" as const,
  degraded: false,
};

describe("NewsService.sendDigestToGuild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("envoie le digest et enregistre les URLs publiées", async () => {
    await prisma.newsChannel.create({ data: { guildId: "g1", channelId: "c1" } });

    const channels = await NewsService.sendDigestToGuild("g1");

    expect(channels).toEqual(["c1"]);
    expect(send).toHaveBeenCalledOnce();
    const sent = await prisma.sentNews.findMany({ where: { guildId: "g1" } });
    expect(sent.map((s) => s.url).sort()).toEqual([
      "https://n.test/1",
      "https://n.test/2",
      "https://n.test/3",
    ]);
  });

  it("mentionne le rôle configuré", async () => {
    await prisma.newsChannel.create({ data: { guildId: "g2", channelId: "c2", roleId: "r2" } });

    await NewsService.sendDigestToGuild("g2");

    expect(send.mock.calls[0][0].content).toBe("<@&r2>");
  });

  it("transmet les URLs déjà publiées au sourcing", async () => {
    await prisma.newsChannel.create({ data: { guildId: "g3", channelId: "c3" } });
    await prisma.sentNews.create({ data: { guildId: "g3", url: "https://n.test/1", title: "T1" } });

    await NewsService.sendDigestToGuild("g3");

    const sentUrls = buildDigest.mock.calls[0][2] as Set<string>;
    expect(sentUrls.has("https://n.test/1")).toBe(true);
  });

  it("renvoie une liste vide quand le sourcing échoue", async () => {
    await prisma.newsChannel.create({ data: { guildId: "g4", channelId: "c4" } });
    buildDigest.mockResolvedValue(null);

    expect(await NewsService.sendDigestToGuild("g4")).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("renvoie une liste vide quand aucun salon n'est configuré", async () => {
    expect(await NewsService.sendDigestToGuild("g-inconnu")).toEqual([]);
    expect(buildDigest).not.toHaveBeenCalled();
  });
});

describe("NewsService.tick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("n'ouvre aucun créneau quand aucune heure n'est configurée", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt1", channelId: "c1" } });

    await NewsService.tick(new Date("2026-08-04T06:00:00Z"));

    expect(await prisma.newsRun.count()).toBe(0);
  });

  it("ouvre et envoie le créneau à l'heure configurée, dans le fuseau du serveur", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt2", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt2", 8);
    await GuildSettingsService.setTimezone("gt2", "Europe/Paris");

    // 06:00 UTC = 08:00 à Paris en août.
    await NewsService.tick(new Date("2026-08-04T06:00:00Z"));

    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt2" } });
    expect(run?.slotHour).toBe(8);
    expect(run?.runDate).toBe("2026-08-04");
    expect(run?.status).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
  });

  it("ne republie pas un créneau déjà envoyé au tick suivant", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt3", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt3", 8);
    await GuildSettingsService.setTimezone("gt3", "UTC");

    await NewsService.tick(new Date("2026-08-04T08:00:00Z"));
    await NewsService.tick(new Date("2026-08-04T08:30:00Z"));

    expect(send).toHaveBeenCalledOnce();
    expect(await prisma.newsRun.count({ where: { guildId: "gt3" } })).toBe(1);
  });

  it("planifie une nouvelle tentative 30 minutes après un échec", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt4", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt4", 8);
    await GuildSettingsService.setTimezone("gt4", "UTC");
    buildDigest.mockResolvedValue(null);

    const now = new Date("2026-08-04T08:00:00Z");
    await NewsService.tick(now);

    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt4" } });
    expect(run?.status).toBe("pending");
    expect(run?.attempts).toBe(1);
    expect(run?.nextAttemptAt?.getTime()).toBe(now.getTime() + 30 * 60 * 1000);
  });

  it("retente au tick suivant et réussit", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt5", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt5", 8);
    await GuildSettingsService.setTimezone("gt5", "UTC");

    buildDigest.mockResolvedValueOnce(null);
    await NewsService.tick(new Date("2026-08-04T08:00:00Z"));

    buildDigest.mockResolvedValue(DIGEST);
    await NewsService.tick(new Date("2026-08-04T08:30:00Z"));

    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt5" } });
    expect(run?.status).toBe("sent");
    expect(run?.attempts).toBe(1);
    expect(send).toHaveBeenCalledOnce();
  });

  it("abandonne le créneau après trois échecs", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt6", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt6", 8);
    await GuildSettingsService.setTimezone("gt6", "UTC");
    buildDigest.mockResolvedValue(null);

    await NewsService.tick(new Date("2026-08-04T08:00:00Z"));
    await NewsService.tick(new Date("2026-08-04T08:30:00Z"));
    await NewsService.tick(new Date("2026-08-04T09:00:00Z"));
    await NewsService.tick(new Date("2026-08-04T09:30:00Z"));

    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt6" } });
    expect(run?.status).toBe("failed");
    expect(run?.attempts).toBe(3);
    expect(run?.nextAttemptAt).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("rattrape un créneau manqué pendant un arrêt du bot", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt7", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt7", 8);
    await GuildSettingsService.setTimezone("gt7", "UTC");

    // Le tick de 8h00 n'a pas eu lieu ; celui de 8h30 est encore dans l'heure 8.
    await NewsService.tick(new Date("2026-08-04T08:30:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt7", status: "sent" } })).toBe(1);
  });

  it("ignore un serveur sans salon de news même s'il a des heures configurées", async () => {
    await GuildSettingsService.addNewsHour("gt8", 8);
    await GuildSettingsService.setTimezone("gt8", "UTC");

    await NewsService.tick(new Date("2026-08-04T08:00:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt8" } })).toBe(0);
  });

  it("traite deux serveurs indépendamment dans des fuseaux différents", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt9a", channelId: "ca" } });
    await GuildSettingsService.addNewsHour("gt9a", 8);
    await GuildSettingsService.setTimezone("gt9a", "UTC");

    await prisma.newsChannel.create({ data: { guildId: "gt9b", channelId: "cb" } });
    await GuildSettingsService.addNewsHour("gt9b", 8);
    await GuildSettingsService.setTimezone("gt9b", "Asia/Tokyo");

    // 08:00 UTC = 17:00 à Tokyo : seul le premier serveur doit publier.
    await NewsService.tick(new Date("2026-08-04T08:00:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt9a" } })).toBe(1);
    expect(await prisma.newsRun.count({ where: { guildId: "gt9b" } })).toBe(0);
  });
});

describe("NewsService — protection contre les doubles envois (fix round 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("deux ticks qui se recouvrent n'envoient le digest qu'une seule fois", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt10", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt10", 8);
    await GuildSettingsService.setTimezone("gt10", "UTC");

    const now = new Date("2026-08-04T08:00:00Z");

    // Le créneau est déjà ouvert, comme si un premier tick l'avait fait :
    // on isole ainsi la course sur `processPendingRuns`, celle que corrige
    // la réservation atomique — `openDueSlots` est déjà protégé par la
    // contrainte unique et son try/catch par serveur.
    await prisma.newsRun.create({
      data: { guildId: "gt10", runDate: localDateInTimezone("UTC", now), slotHour: 8 },
    });

    // Les deux ticks partagent le même `now` et sont lancés en parallèle :
    // leurs `await` internes (settings, digest, envoi Discord) les font
    // s'entrelacer réellement, ce qui exerce la réservation atomique plutôt
    // que de simplement les exécuter l'un après l'autre.
    await Promise.all([NewsService.tick(now), NewsService.tick(now)]);

    expect(send).toHaveBeenCalledOnce();
    expect(await prisma.newsRun.count({ where: { guildId: "gt10" } })).toBe(1);
    expect(await prisma.newsRun.count({ where: { guildId: "gt10", status: "sent" } })).toBe(1);
  });

  it("un échec de mise à jour du statut après un envoi réussi ne planifie pas de nouvelle tentative", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt11", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt11", 8);
    await GuildSettingsService.setTimezone("gt11", "UTC");

    // Ne fait échouer que le prochain appel à `.update` (la mise à jour de
    // statut du créneau) : la réservation atomique utilise `.updateMany` et
    // n'est donc pas affectée par ce mock.
    //
    // Rustine manuelle plutôt que `vi.spyOn(...).mockRestore()` : sur les
    // méthodes du client Prisma (portées par un Proxy), `mockRestore()` ne
    // les restaure pas correctement — la propriété redevient `undefined`
    // (vérifié empiriquement), ce qui cassait silencieusement tous les
    // `prisma.newsRun.update` des tests suivants dans ce fichier. On
    // sauvegarde donc la référence originale à la main et on la réassigne
    // nous-mêmes à la fin.
    const originalUpdate = prisma.newsRun.update.bind(prisma.newsRun);
    let updateCalls = 0;
    (prisma.newsRun as unknown as { update: typeof prisma.newsRun.update }).update = ((...args) => {
      updateCalls += 1;
      if (updateCalls === 1) {
        throw new Error("DB indisponible");
      }
      return originalUpdate(...args);
    }) as typeof prisma.newsRun.update;

    try {
      await NewsService.tick(new Date("2026-08-04T08:00:00Z"));

      expect(send).toHaveBeenCalledOnce();

      const run = await prisma.newsRun.findFirst({ where: { guildId: "gt11" } });
      // Le chemin d'échec (celui qui appelle `nextRunState` et pousserait
      // `nextAttemptAt` 30 minutes plus tard) n'a pas été emprunté : l'échec de
      // la mise à jour de statut est resté cantonné à son propre try/catch, qui
      // se contente de journaliser. `nextAttemptAt` est donc resté à sa valeur
      // d'avant l'envoi (null), jamais poussé dans le futur — et le message
      // d'erreur de sourcing n'a pas été écrit puisque le sourcing a réussi.
      expect(run?.nextAttemptAt).toBeNull();
      expect(run?.lastError).not.toBe("sourcing indisponible");
      expect(run?.status).not.toBe("failed");
    } finally {
      (prisma.newsRun as unknown as { update: typeof prisma.newsRun.update }).update = originalUpdate;
    }
  });

  it("un échec d'écriture SentNews après un envoi réussi reste un succès", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt12", channelId: "c1" } });

    // Même rustine manuelle que ci-dessus, pour la même raison : `mockRestore()`
    // sur `prisma.sentNews.createMany` casse la méthode pour les tests suivants.
    const originalCreateMany = prisma.sentNews.createMany.bind(prisma.sentNews);
    let createManyCalls = 0;
    (prisma.sentNews as unknown as { createMany: typeof prisma.sentNews.createMany }).createMany = ((...args) => {
      createManyCalls += 1;
      if (createManyCalls === 1) {
        throw new Error("DB indisponible");
      }
      return originalCreateMany(...args);
    }) as typeof prisma.sentNews.createMany;

    try {
      const delivered = await NewsService.sendDigestToGuild("gt12");

      expect(delivered).toEqual(["c1"]);
      expect(send).toHaveBeenCalledOnce();
    } finally {
      (prisma.sentNews as unknown as { createMany: typeof prisma.sentNews.createMany }).createMany = originalCreateMany;
    }
  });
});

describe("NewsService — bail sur les créneaux \"sending\" (fix round 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("reprend un créneau resté bloqué en \"sending\" au-delà du bail", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt13", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    // 25 minutes > le bail de 20 minutes : le créneau est orphelin, comme si
    // le processus avait été tué entre la réservation et l'envoi.
    const staleUpdatedAt = new Date(now.getTime() - 25 * 60 * 1000);

    const created = await prisma.newsRun.create({
      data: { guildId: "gt13", runDate: "2026-08-04", slotHour: 8, status: "sending" },
    });
    // `updatedAt` est géré par Prisma (`@updatedAt`) et écrasé à l'heure
    // réelle sur `create`/`update` : on le recule directement en SQL brut
    // pour simuler une réservation orpheline depuis 25 minutes.
    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${staleUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    expect(send).toHaveBeenCalledOnce();
    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    expect(run?.status).toBe("sent");
  });

  it("laisse un créneau \"sending\" récent intact (bail non expiré)", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt14", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    // 5 minutes < le bail de 20 minutes : un envoi est probablement encore en
    // cours, ce créneau ne doit pas être repris.
    const recentUpdatedAt = new Date(now.getTime() - 5 * 60 * 1000);

    const created = await prisma.newsRun.create({
      data: { guildId: "gt14", runDate: "2026-08-04", slotHour: 8, status: "sending" },
    });
    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${recentUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    // C'est cette assertion qui empêche le bail de réintroduire le double
    // envoi corrigé au round 1 : un "sending" trop récent doit rester
    // invisible au planificateur.
    expect(send).not.toHaveBeenCalled();
    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    expect(run?.status).toBe("sending");
    expect(run?.updatedAt.getTime()).toBe(recentUpdatedAt.getTime());
  });
});

describe("NewsService — reprise d'un créneau déjà livré (fix round 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("clôture sans renvoyer un créneau \"sending\" dont les articles sont déjà enregistrés", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt15", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    const staleUpdatedAt = new Date(now.getTime() - 25 * 60 * 1000);

    const created = await prisma.newsRun.create({
      data: { guildId: "gt15", runDate: "2026-08-04", slotHour: 8, status: "sending" },
    });

    // Preuve d'une livraison réussie dont seule l'écriture du statut a échoué :
    // `sendDigestToGuild` écrit ces lignes juste après l'envoi Discord.
    // `sentAt` est postérieur à `createdAt` du créneau (défaut `now()`).
    await prisma.sentNews.createMany({
      data: [
        { guildId: "gt15", url: "https://n.test/1", title: "T1" },
        { guildId: "gt15", url: "https://n.test/2", title: "T2" },
      ],
    });

    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${staleUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    // C'est l'assertion centrale : le digest ne repart pas une seconde fois.
    expect(send).not.toHaveBeenCalled();
    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    expect(run?.status).toBe("sent");
  });

  it("renvoie un créneau \"sending\" sans aucun article enregistré depuis son ouverture", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt16", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    const staleUpdatedAt = new Date(now.getTime() - 25 * 60 * 1000);

    // Une livraison ANTÉRIEURE à l'ouverture du créneau (créneau de la veille)
    // ne doit pas être confondue avec une livraison de ce créneau-ci.
    await prisma.sentNews.create({
      data: {
        guildId: "gt16",
        url: "https://n.test/vieux",
        title: "Vieux",
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const created = await prisma.newsRun.create({
      data: { guildId: "gt16", runDate: "2026-08-04", slotHour: 8, status: "sending" },
    });
    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${staleUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    expect(send).toHaveBeenCalledOnce();
    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    expect(run?.status).toBe("sent");
  });

  it("consomme une tentative à chaque reprise", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt17", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    const staleUpdatedAt = new Date(now.getTime() - 25 * 60 * 1000);

    const created = await prisma.newsRun.create({
      data: { guildId: "gt17", runDate: "2026-08-04", slotHour: 8, status: "sending" },
    });
    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${staleUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    // Sans cet incrément, un créneau qui replonge en "sending" à chaque fois
    // serait repris toutes les 30 minutes sans jamais atteindre le plafond.
    expect(run?.attempts).toBe(1);
  });

  it("abandonne un créneau repris trop de fois", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt18", channelId: "c1" } });

    const now = new Date("2026-08-04T08:00:00Z");
    const staleUpdatedAt = new Date(now.getTime() - 25 * 60 * 1000);

    // 2 tentatives déjà consommées : cette reprise serait la troisième.
    const created = await prisma.newsRun.create({
      data: { guildId: "gt18", runDate: "2026-08-04", slotHour: 8, status: "sending", attempts: 2 },
    });
    await prisma.$executeRaw`UPDATE "NewsRun" SET "updatedAt" = ${staleUpdatedAt} WHERE id = ${created.id}`;

    await NewsService.tick(now);

    expect(send).not.toHaveBeenCalled();
    const run = await prisma.newsRun.findUnique({ where: { id: created.id } });
    expect(run?.status).toBe("failed");
    expect(run?.attempts).toBe(3);
  });
});

describe("NewsService — rattrapage des créneaux manqués et borne du tick (fix round 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigest.mockResolvedValue(DIGEST);
  });

  it("ouvre en retard un créneau d'une heure déjà passée aujourd'hui", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt19", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt19", 8);
    await GuildSettingsService.setTimezone("gt19", "UTC");

    // Le tick de 8h n'a jamais tourné (bloqué par `noOverlap`) : à 10h, le
    // créneau de 8h doit malgré tout être ouvert, dans la fenêtre de
    // rattrapage.
    await NewsService.tick(new Date("2026-08-04T10:00:00Z"));

    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt19" } });
    expect(run?.slotHour).toBe(8);
    expect(run?.runDate).toBe("2026-08-04");
    expect(run?.status).toBe("sent");
  });

  it("n'ouvre pas un créneau dont l'heure est encore à venir aujourd'hui", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt20", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt20", 20);
    await GuildSettingsService.setTimezone("gt20", "UTC");

    await NewsService.tick(new Date("2026-08-04T10:00:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt20" } })).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("ne rattrape pas une heure passée depuis trop longtemps", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt21", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt21", 8);
    await GuildSettingsService.setTimezone("gt21", "UTC");

    // 20h : le créneau de 8h est hors de la fenêtre de rattrapage (3 h).
    await NewsService.tick(new Date("2026-08-04T20:00:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt21" } })).toBe(0);
  });

  it("ne réouvre pas un créneau passé qui existe déjà, quel que soit son statut", async () => {
    await prisma.newsChannel.create({ data: { guildId: "gt22", channelId: "c1" } });
    await GuildSettingsService.addNewsHour("gt22", 8);
    await GuildSettingsService.setTimezone("gt22", "UTC");

    await prisma.newsRun.create({
      data: { guildId: "gt22", runDate: "2026-08-04", slotHour: 8, status: "failed", attempts: 3 },
    });

    await NewsService.tick(new Date("2026-08-04T10:00:00Z"));

    expect(await prisma.newsRun.count({ where: { guildId: "gt22" } })).toBe(1);
    const run = await prisma.newsRun.findFirst({ where: { guildId: "gt22" } });
    expect(run?.status).toBe("failed");
    expect(send).not.toHaveBeenCalled();
  });

  it("s'arrête au budget du tick et laisse les créneaux restants en attente", async () => {
    for (const guildId of ["gt23a", "gt23b", "gt23c"]) {
      await prisma.newsChannel.create({ data: { guildId, channelId: `c-${guildId}` } });
      await prisma.newsRun.create({
        data: { guildId, runDate: "2026-08-04", slotHour: 8, status: "pending" },
      });
    }

    // Chaque sourcing prend 250 ms de temps réel ; avec un budget de 100 ms, le
    // budget est dépassé dès la fin du premier créneau.
    buildDigest.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return DIGEST;
    });

    await NewsService.tick(new Date("2026-08-04T08:00:00Z"), 100);

    expect(send).toHaveBeenCalledOnce();
    expect(await prisma.newsRun.count({ where: { status: "sent", runDate: "2026-08-04", guildId: { startsWith: "gt23" } } })).toBe(1);
    // Les deux autres n'ont pas été touchés : toujours "pending", donc repris
    // au tick suivant.
    expect(
      await prisma.newsRun.count({ where: { status: "pending", guildId: { startsWith: "gt23" } } })
    ).toBe(2);
  });
});
