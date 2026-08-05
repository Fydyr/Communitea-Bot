import type { TextChannel, NewsChannel as DiscordNewsChannel } from "discord.js";
import { bot } from "../index";
import { prisma } from "../lib/prisma";
import { LoggerService } from "./LoggerService";
import { GuildSettingsService } from "./GuildSettingsService";
import { NewsSourceService } from "./NewsSourceService";
import { buildNewsEmbed, formatNewsDate } from "./newsEmbed";
import { isDue, localDateInTimezone, localHourInTimezone, nextRunState, MAX_ATTEMPTS } from "./newsSchedule";

/** Fenêtre d'anti-doublon : une URL publiée reste bloquée pendant 7 jours. */
const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Au-delà de ce délai, un créneau resté en "sending" est considéré comme
 * orphelin — le processus a été interrompu en cours d'envoi — et il est repris.
 * Volontairement plus court que le cycle de 30 minutes du cron, pour qu'un
 * créneau récupéré soit repris au tick suivant plutôt que d'attendre un cycle
 * de plus ; et confortablement plus long que la durée d'un envoi légitime.
 */
const CLAIM_LEASE_MS = 20 * 60 * 1000;

/**
 * Fenêtre de rattrapage des créneaux manqués. Un créneau dont l'heure est
 * passée depuis moins de ce délai — parce qu'un tick trop long a bloqué le
 * suivant (`noOverlap`) ou que le bot était arrêté — est ouvert en retard
 * plutôt que perdu en silence. Au-delà, on ne rattrape pas : republier les
 * news du matin en pleine nuit n'a aucun intérêt, et un premier démarrage en
 * fin de journée déclencherait sinon tous les créneaux du jour d'un coup.
 */
const CATCH_UP_WINDOW_HOURS = 3;

/**
 * Budget de temps d'un tick. Le cron passe toutes les 30 minutes avec
 * `noOverlap: true` : un tick qui déborde bloque le suivant, donc
 * `openDueSlots` ne tourne plus et des créneaux sont manqués. On arrête donc
 * de traiter de nouveaux créneaux au-delà de ce budget ; ceux qui restent
 * sont encore "pending" et seront repris au tick suivant. 15 minutes laissent
 * la place au créneau en cours de finir (quelques minutes au pire) tout en
 * gardant une marge confortable avant la cadence de 30 minutes.
 */
const TICK_BUDGET_MS = 15 * 60 * 1000;

/**
 * Plafond de créneaux examinés en un tick. Le budget de temps est la vraie
 * borne ; ce plafond évite seulement de charger en mémoire une file
 * arbitrairement longue.
 */
const MAX_RUNS_PER_TICK = 50;

export class NewsService {
  /** URLs déjà publiées sur ce serveur dans la fenêtre d'anti-doublon. */
  private static async recentUrls(guildId: string, now: Date): Promise<Set<string>> {
    const rows = await prisma.sentNews.findMany({
      where: { guildId, sentAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) } },
      select: { url: true },
    });
    return new Set(rows.map((row) => row.url));
  }

  /**
   * Construit puis publie le digest d'un serveur dans tous ses salons de news.
   * Renvoie les identifiants des salons servis ; une liste vide signale un
   * échec, que l'appelant traduit en nouvelle tentative.
   */
  public static async sendDigestToGuild(guildId: string, now: Date = new Date()): Promise<string[]> {
    const channels = await prisma.newsChannel.findMany({ where: { guildId } });

    if (channels.length === 0) {
      await LoggerService.warning(`Aucun salon de news configuré pour le serveur ${guildId}`);
      return [];
    }

    const settings = await GuildSettingsService.get(guildId);
    const sentUrls = await this.recentUrls(guildId, now);

    const digest = await NewsSourceService.buildDigest(settings.language, settings.themes, sentUrls, now);

    if (!digest) {
      return [];
    }

    const embed = buildNewsEmbed(digest, settings.language, formatNewsDate(settings.language, settings.timezone, now));

    if (bot.user) {
      embed.setAuthor({ name: bot.user.username, iconURL: bot.user.displayAvatarURL() });
    }

    const delivered: string[] = [];

    for (const channelConfig of channels) {
      try {
        const channel = await bot.channels.fetch(channelConfig.channelId);

        if (!channel || typeof (channel as { send?: unknown }).send !== "function") {
          await LoggerService.warning(`Salon de news ${channelConfig.channelId} introuvable ou non textuel`);
          continue;
        }

        await (channel as TextChannel | DiscordNewsChannel).send({
          content: channelConfig.roleId ? `<@&${channelConfig.roleId}>` : undefined,
          embeds: [embed],
        });

        delivered.push(channelConfig.channelId);
      } catch (error) {
        await LoggerService.error(`Erreur d'envoi des news au salon ${channelConfig.channelId}: ${error}`);
      }
    }

    if (delivered.length === 0) {
      return [];
    }

    // Le digest est déjà sur Discord : un échec d'écriture ici ne doit jamais
    // transformer un envoi réussi en échec (ce qui déclencherait une
    // republication). On log et on continue, l'anti-doublon sera juste moins
    // efficace pour ces articles tant que la base n'est pas revenue.
    try {
      await prisma.sentNews.createMany({
        data: digest.items.map((item) => ({ guildId, url: item.url, title: item.title })),
      });
    } catch (error) {
      await LoggerService.error(
        `News envoyées au serveur ${guildId} mais échec de l'enregistrement anti-doublon (SentNews): ${error}`
      );
    }

    await LoggerService.success(
      `News envoyées au serveur ${guildId} (${digest.items.length} article(s), source ${digest.tier})`
    );

    return delivered;
  }

  /**
   * Ouvre les créneaux dont l'heure est arrivée, ainsi que ceux déjà passés
   * aujourd'hui dans la fenêtre de rattrapage et qui n'ont jamais été ouverts.
   *
   * Le rattrapage comble le trou décrit au round 3 : un tick qui déborde de la
   * cadence de 30 minutes bloque le suivant (`noOverlap`), donc l'heure
   * suivante n'est jamais ouverte — aucune ligne `NewsRun`, donc rien à
   * retenter et aucune trace. Un tick ultérieur l'ouvre désormais en retard.
   *
   * Le `findUnique` n'est pas filtré par statut : un créneau déjà ouvert
   * (quel que soit son statut, y compris "sent" ou "failed") n'est jamais
   * recréé ni réinitialisé.
   */
  private static async openDueSlots(now: Date): Promise<void> {
    const guilds = await prisma.newsChannel.findMany({
      distinct: ["guildId"],
      select: { guildId: true },
    });

    for (const { guildId } of guilds) {
      try {
        const settings = await GuildSettingsService.get(guildId);
        if (settings.newsHours.length === 0) {
          continue;
        }

        const currentHour = localHourInTimezone(settings.timezone, now);
        const runDate = localDateInTimezone(settings.timezone, now);

        // Heures échues aujourd'hui : l'heure courante et, en rattrapage,
        // celles passées depuis moins de `CATCH_UP_WINDOW_HOURS`. Un `delta`
        // négatif désigne une heure encore à venir aujourd'hui : on ne
        // l'ouvre pas.
        const dueHours = settings.newsHours
          .filter((hour) => {
            const delta = currentHour - hour;
            return delta >= 0 && delta <= CATCH_UP_WINDOW_HOURS;
          })
          .sort((a, b) => a - b);

        for (const slotHour of dueHours) {
          const existing = await prisma.newsRun.findUnique({
            where: { guildId_runDate_slotHour: { guildId, runDate, slotHour } },
          });

          if (existing) {
            continue;
          }

          await prisma.newsRun.create({ data: { guildId, runDate, slotHour } });

          if (slotHour === currentHour) {
            await LoggerService.info(`Créneau news ouvert pour ${guildId} (${slotHour}h ${settings.timezone})`);
          } else {
            await LoggerService.info(
              `Créneau news ouvert EN RETARD pour ${guildId} (${slotHour}h ${settings.timezone}, il est ${currentHour}h) : le tick de ce créneau a été manqué`
            );
          }
        }
      } catch (error) {
        await LoggerService.error(`Erreur à l'ouverture du créneau news de ${guildId}: ${error}`);
      }
    }
  }

  /** Tente l'envoi des créneaux en attente dont l'échéance est atteinte. */
  private static async processPendingRuns(now: Date, budgetMs: number = TICK_BUDGET_MS): Promise<void> {
    const staleFloor = new Date(now.getTime() - CLAIM_LEASE_MS);

    // Candidats : les créneaux "pending" classiques, plus les créneaux
    // "sending" dont le bail a expiré. Sans ce second cas, un processus tué
    // entre la réservation (round 1) et la mise à jour finale — OOM,
    // redémarrage de conteneur, déploiement — abandonnerait le créneau en
    // silence pour toujours : `openDueSlots` ne recrée pas la ligne (son
    // `findUnique` n'est pas filtré par statut) et cette méthode ne
    // sélectionnait jusqu'ici que "pending". Contrairement au chemin
    // "failed", cet abandon ne journalisait même pas.
    const candidates = await prisma.newsRun.findMany({
      where: {
        OR: [{ status: "pending" }, { status: "sending", updatedAt: { lt: staleFloor } }],
      },
      orderBy: { createdAt: "asc" },
      take: MAX_RUNS_PER_TICK,
    });

    // Repère de temps réel (et non le `now` injecté, qui est figé dans les
    // tests) : c'est la durée effectivement écoulée qu'il faut borner.
    const startedAt = Date.now();

    for (const [index, run] of candidates.entries()) {
      // Garde-fou de durée : un serveur dont le sourcing rame peut coûter
      // plusieurs minutes, et le tick est séquentiel. Au-delà du budget on
      // s'arrête ; les créneaux restants sont toujours "pending" et seront
      // repris au tick suivant, plutôt que de faire déborder ce tick sur le
      // suivant et de bloquer `openDueSlots`.
      if (Date.now() - startedAt > budgetMs) {
        await LoggerService.warning(
          `Tick news interrompu après ${Math.round((Date.now() - startedAt) / 1000)}s (budget ${budgetMs / 60000} min) : ${candidates.length - index} créneau(x) laissé(s) en attente pour le tick suivant`
        );
        break;
      }

      const isStaleClaim = run.status === "sending";

      // Un "pending" respecte encore l'échéance de retry (`nextAttemptAt`) ;
      // un "sending" expiré est dû par définition, puisque son bail est
      // justement ce qui vient d'expirer — il n'a pas de `nextAttemptAt` à
      // faire respecter.
      if (!isStaleClaim && !isDue(run.nextAttemptAt, now)) {
        continue;
      }

      // Réservation atomique du créneau : on fait basculer son statut vers
      // "sending" en une seule opération conditionnée sur EXACTEMENT le même
      // critère que la sélection ci-dessus. C'est le statut — pas `attempts`
      // — qui doit porter la réservation (cf. round 1) : il retire
      // immédiatement la ligne de toute sélection suivante, qu'elle soit
      // strictement simultanée ou décalée dans le temps.
      //
      // Le cas « interrompu APRÈS la livraison mais avant la mise à jour du
      // statut » n'est plus un compromis : il est détecté juste en dessous,
      // via les lignes `SentNews` écrites par la livraison.
      const claimed = await prisma.newsRun.updateMany({
        where: {
          id: run.id,
          OR: [{ status: "pending" }, { status: "sending", updatedAt: { lt: staleFloor } }],
        },
        // Une reprise consomme une tentative. Sans ça, un créneau qui échoue
        // toujours de la même manière serait repris toutes les 30 minutes
        // indéfiniment, sans jamais atteindre le plafond de `MAX_ATTEMPTS`.
        data: isStaleClaim ? { status: "sending", attempts: run.attempts + 1 } : { status: "sending" },
      });

      if (claimed.count === 0) {
        continue;
      }

      if (isStaleClaim) {
        // Signal indispensable pour l'opérateur : ce créneau vient d'être
        // récupéré après une interruption du processus, pas traité pour la
        // première fois — à surveiller si ça se répète.
        await LoggerService.warning(
          `Créneau news repris après interruption pour ${run.guildId} (créneau ${run.slotHour}h du ${run.runDate}), bloqué en "sending" depuis plus de ${CLAIM_LEASE_MS / 60000} minutes`
        );

        // Un créneau bloqué en "sending" recouvre deux situations très
        // différentes : interrompu AVANT la livraison (rien n'est parti, il
        // faut envoyer) ou interrompu APRÈS (le digest est déjà sur Discord,
        // seule l'écriture du statut a échoué). `sendDigestToGuild` écrit les
        // lignes `SentNews` juste après une livraison réussie : leur présence
        // depuis l'ouverture du créneau est donc la preuve que le digest est
        // parti. Sans cette vérification, la reprise republierait un digest
        // déjà livré.
        const alreadyDelivered = await prisma.sentNews.count({
          where: { guildId: run.guildId, sentAt: { gte: run.createdAt } },
        });

        if (alreadyDelivered > 0) {
          await prisma.newsRun.update({
            where: { id: run.id },
            data: { status: "sent", nextAttemptAt: null },
          });
          await LoggerService.warning(
            `Créneau news de ${run.guildId} (${run.slotHour}h du ${run.runDate}) trouvé interrompu APRÈS livraison (${alreadyDelivered} article(s) déjà enregistré(s)) : clôturé sans nouvel envoi`
          );
          continue;
        }

        // Plafond de reprises : aligné sur `nextRunState`, qui abandonne dès
        // que le nombre de tentatives consommées atteint `MAX_ATTEMPTS`.
        if (run.attempts + 1 >= MAX_ATTEMPTS) {
          await prisma.newsRun.update({
            where: { id: run.id },
            data: {
              status: "failed",
              nextAttemptAt: null,
              lastError: "reprises épuisées après interruptions répétées",
            },
          });
          await LoggerService.error(
            `News abandonnées pour ${run.guildId} (créneau ${run.slotHour}h du ${run.runDate}) après ${run.attempts + 1} reprises`
          );
          continue;
        }
      }

      try {
        const delivered = await this.sendDigestToGuild(run.guildId, now);

        if (delivered.length > 0) {
          // Le digest est parti : quoi qu'il arrive à partir d'ici, ce n'est
          // plus un échec d'envoi. Une erreur sur cette seule mise à jour de
          // statut est journalisée et on passe au créneau suivant — elle ne
          // doit jamais retomber dans le catch global, qui planifierait une
          // republication du même digest.
          //
          // Si cette mise à jour échoue, le créneau reste sur "sending" et
          // sera repris par le bail à l'expiration de celui-ci. Ce n'est pas
          // une republication : la reprise commence par vérifier les lignes
          // `SentNews` écrites lors de cette livraison et, les trouvant, se
          // contente de clôturer le créneau en "sent". La garantie n'est donc
          // pas « aucun tick futur ne reprend ce créneau », mais « une reprise
          // qui constate une livraison déjà faite ne renvoie rien ».
          try {
            await prisma.newsRun.update({
              where: { id: run.id },
              data: { status: "sent", nextAttemptAt: null, lastError: null },
            });
          } catch (updateError) {
            await LoggerService.error(
              `News envoyées pour ${run.guildId} (créneau ${run.slotHour}h du ${run.runDate}) mais échec de la mise à jour du statut du créneau: ${updateError}`
            );
          }
          continue;
        }

        const state = nextRunState(run.attempts, now);
        await prisma.newsRun.update({
          where: { id: run.id },
          data: {
            status: state.status,
            attempts: state.attempts,
            nextAttemptAt: state.nextAttemptAt,
            lastError: "sourcing indisponible",
          },
        });

        if (state.status === "failed") {
          await LoggerService.error(
            `News abandonnées pour ${run.guildId} (créneau ${run.slotHour}h du ${run.runDate}) après ${state.attempts} tentatives`
          );
        } else {
          await LoggerService.warning(
            `News reportées pour ${run.guildId} (créneau ${run.slotHour}h), tentative ${state.attempts}/3`
          );
        }
      } catch (error) {
        const state = nextRunState(run.attempts, now);
        await prisma.newsRun.update({
          where: { id: run.id },
          data: {
            status: state.status,
            attempts: state.attempts,
            nextAttemptAt: state.nextAttemptAt,
            lastError: String(error).substring(0, 500),
          },
        });
        await LoggerService.error(`Erreur lors de l'envoi des news pour ${run.guildId}: ${error}`);
      }
    }
  }

  /**
   * Un passage du planificateur : ouverture des créneaux dus, puis traitement
   * des tentatives en attente. Appelé par le cron toutes les 30 minutes.
   *
   * `budgetMs` n'est là que pour les tests : la production utilise
   * `TICK_BUDGET_MS`, comme `now` utilise l'horloge réelle.
   */
  public static async tick(now: Date = new Date(), budgetMs: number = TICK_BUDGET_MS): Promise<void> {
    try {
      await this.openDueSlots(now);
      await this.processPendingRuns(now, budgetMs);
    } catch (error) {
      await LoggerService.error(`Erreur du planificateur de news: ${error}`);
    }
  }
}
