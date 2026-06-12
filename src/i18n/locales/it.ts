import type { MessageKey } from "./fr";

export const it: Record<MessageKey, string> = {
  "common.notInGuild": "❌ Questo comando deve essere usato in un server.",
  "common.error": "❌ Si è verificato un errore.",

  "setup.updated": "✅ Configurazione aggiornata per <#{channel}>{roleSuffix}.",
  "setup.created": "✅ Gli aneddoti verranno inviati in <#{channel}>{roleSuffix}.",
  "setup.roleSuffix": " menzionando <@&{role}>",
  "setup.error": "❌ Si è verificato un errore durante la configurazione.",

  "remove.success": "✅ Il canale <#{channel}> non riceverà più aneddoti.",
  "remove.notConfigured": "⚠️ Il canale <#{channel}> non era configurato per gli aneddoti.",
  "remove.error": "❌ Si è verificato un errore durante la rimozione della configurazione.",

  "list.empty": "📭 Nessun canale è configurato per gli aneddoti su questo server.\nUsa `/setup` per configurarne uno.",
  "list.title": "📚 Canali degli aneddoti configurati",
  "list.footer": "{count} canale/i configurato/i",

  "send.noPermission": "❌ Non hai il permesso di usare questo comando.",
  "send.noChannel": "❌ Nessun canale è configurato per gli aneddoti su questo server.\nUsa `/setup` per configurarne uno.",
  "send.success": "✅ Aneddoto inviato in: {channels}",
  "send.error": "❌ Errore durante l'invio dell'aneddoto. Controlla i log.",

  "stats.title": "📊 Statistiche degli aneddoti",
  "stats.sent": "📤 Aneddoti inviati",
  "stats.channelsGlobal": "🌐 Canali (globale)",
  "stats.channelsGuild": "📍 Canali (questo server)",

  "hourAdd.invalid": "❌ L'ora deve essere un numero intero tra 0 e 23.",
  "hourAdd.exists": "⚠️ L'ora {hour}:00 è già configurata.",
  "hourAdd.added": "✅ Ora {hour}:00 aggiunta. Orari di invio: {hours}.",

  "hourRemove.notPresent": "⚠️ L'ora {hour}:00 non è configurata.",
  "hourRemove.removed": "✅ Ora {hour}:00 rimossa. Orari di invio: {hours}.",
  "hourRemove.emptied": "✅ Ora {hour}:00 rimossa. Non è più configurata alcuna ora: questo server non riceverà più aneddoti automatici (l'invio manuale resta possibile).",

  "schedule.title": "🗓️ Orario degli aneddoti",
  "schedule.hours": "🕐 Orari di invio",
  "schedule.timezone": "🌍 Fuso orario",
  "schedule.language": "🗣️ Lingua",
  "schedule.noHours": "Nessuno (invii automatici disattivati)",
  "schedule.defaultNote": "ℹ️ Valori predefiniti (nessuna configurazione personalizzata).",

  "timezone.invalid": "❌ Fuso orario non valido. Esempio: `Europe/Paris`.",
  "timezone.success": "✅ Fuso orario impostato su `{timezone}`.",

  "language.success": "✅ Lingua impostata su **{language}**.",
};
