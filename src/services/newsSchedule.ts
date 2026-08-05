/** Nombre total de tentatives pour un créneau, première tentative comprise. */
export const MAX_ATTEMPTS = 3;
/** Délai entre deux tentatives. */
export const RETRY_DELAY_MS = 30 * 60 * 1000;
/**
 * Marge appliquée à la sélection des créneaux échus. Le cron passe à :00 et :30,
 * mais une échéance calculée à 8h30:03 arriverait juste après le tick de
 * 8h30:00 et serait repoussée d'une demi-heure. Cette tolérance l'évite.
 */
export const DUE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Date du jour dans un fuseau donné, au format YYYY-MM-DD. Les composants
 * (année, mois, jour) sont extraits et assemblés manuellement pour garantir
 * le format indépendamment de la locale du runtime (même avec small-icu).
 */
export function localDateInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Heure locale (0-23) dans un fuseau donné.
 *
 * `AnecdoteService.getCurrentHourInTimezone` fait la même chose mais lit
 * toujours l'horloge réelle. Le planificateur de news doit pouvoir recevoir une
 * date injectée pour être testable, d'où cette variante paramétrée.
 */
export function localHourInTimezone(timezone: string, now: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(now);
  // Certains environnements renvoient "24" à minuit : on le ramène à 0.
  return parseInt(formatted, 10) % 24;
}

/** Un créneau jamais tenté (échéance nulle) ou dont l'échéance est atteinte. */
export function isDue(nextAttemptAt: Date | null, now: Date): boolean {
  if (!nextAttemptAt) return true;
  return nextAttemptAt.getTime() <= now.getTime() + DUE_TOLERANCE_MS;
}

/**
 * État d'un créneau après une tentative ratée : nouvelle échéance dans 30
 * minutes, ou abandon si le quota de tentatives est épuisé.
 */
export function nextRunState(
  attempts: number,
  now: Date
): { status: "pending" | "failed"; attempts: number; nextAttemptAt: Date | null } {
  const used = attempts + 1;

  if (used >= MAX_ATTEMPTS) {
    return { status: "failed", attempts: used, nextAttemptAt: null };
  }

  return { status: "pending", attempts: used, nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS) };
}
