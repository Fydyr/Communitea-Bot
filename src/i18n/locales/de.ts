import type { MessageKey } from "./fr";

export const de: Record<MessageKey, string> = {
  "common.notInGuild": "❌ Dieser Befehl muss auf einem Server verwendet werden.",
  "common.error": "❌ Es ist ein Fehler aufgetreten.",

  "setup.updated": "✅ Konfiguration für <#{channel}>{roleSuffix} aktualisiert.",
  "setup.created": "✅ Anekdoten werden an <#{channel}>{roleSuffix} gesendet.",
  "setup.roleSuffix": " mit Erwähnung von <@&{role}>",
  "setup.error": "❌ Bei der Konfiguration ist ein Fehler aufgetreten.",

  "remove.success": "✅ Der Kanal <#{channel}> erhält keine Anekdoten mehr.",
  "remove.notConfigured": "⚠️ Der Kanal <#{channel}> war nicht für Anekdoten konfiguriert.",
  "remove.error": "❌ Beim Entfernen der Konfiguration ist ein Fehler aufgetreten.",

  "list.empty": "📭 Auf diesem Server ist kein Kanal für Anekdoten konfiguriert.\nVerwende `/setup`, um einen zu konfigurieren.",
  "list.title": "📚 Konfigurierte Anekdoten-Kanäle",
  "list.footer": "{count} Kanal/Kanäle konfiguriert",

  "send.noPermission": "❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.",
  "send.noChannel": "❌ Auf diesem Server ist kein Kanal für Anekdoten konfiguriert.\nVerwende `/setup`, um einen zu konfigurieren.",
  "send.success": "✅ Anekdote gesendet an: {channels}",
  "send.error": "❌ Fehler beim Senden der Anekdote. Überprüfe die Logs.",

  "stats.title": "📊 Anekdoten-Statistiken",
  "stats.sent": "📤 Gesendete Anekdoten",
  "stats.channelsGlobal": "🌐 Kanäle (global)",
  "stats.channelsGuild": "📍 Kanäle (dieser Server)",

  "hourAdd.invalid": "❌ Die Stunde muss eine ganze Zahl zwischen 0 und 23 sein.",
  "hourAdd.exists": "⚠️ Die Uhrzeit {hour}:00 Uhr ist bereits konfiguriert.",
  "hourAdd.added": "✅ Uhrzeit {hour}:00 Uhr hinzugefügt. Sendezeiten: {hours}.",

  "hourRemove.notPresent": "⚠️ Die Uhrzeit {hour}:00 Uhr ist nicht konfiguriert.",
  "hourRemove.removed": "✅ Uhrzeit {hour}:00 Uhr entfernt. Sendezeiten: {hours}.",
  "hourRemove.emptied": "✅ Uhrzeit {hour}:00 Uhr entfernt. Es ist keine Uhrzeit mehr konfiguriert: Dieser Server erhält keine automatischen Anekdoten mehr (manuelles Senden bleibt möglich).",

  "schedule.title": "🗓️ Anekdoten-Zeitplan",
  "schedule.hours": "🕐 Sendezeiten",
  "schedule.timezone": "🌍 Zeitzone",
  "schedule.language": "🗣️ Sprache",
  "schedule.noHours": "Keine (automatisches Senden deaktiviert)",
  "schedule.defaultNote": "ℹ️ Standardwerte (keine eigene Konfiguration).",

  "timezone.invalid": "❌ Ungültige Zeitzone. Beispiel: `Europe/Paris`.",
  "timezone.success": "✅ Zeitzone auf `{timezone}` gesetzt.",

  "language.success": "✅ Sprache auf **{language}** gesetzt.",
};
