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

  "translate.title": "🌍 Übersetzung auf {language}",
  "translate.footer": "Automatisch übersetzt",

  "about.failed": "❌ Zu diesem Thema konnte keine Anekdote erstellt werden. Versuche es später erneut.",

  "theme.langages": "Programmiersprachen",
  "theme.entreprises": "Tech-Unternehmen",
  "theme.personnalites": "Tech-Persönlichkeiten",
  "theme.jeux-video": "Videospiele",
  "theme.securite": "Cybersicherheit",
  "theme.hardware": "Computer-Hardware",
  "theme.web": "Web und Internet",
  "theme.ia": "Künstliche Intelligenz",
  "theme.histoire": "Geschichte der Informatik",

  "themeAdd.invalid": "❌ Unbekanntes Thema.",
  "themeAdd.exists": "⚠️ Das Thema **{theme}** ist bereits aktiv.",
  "themeAdd.added": "✅ Thema **{theme}** hinzugefügt. Aktive Themen: {themes}.",
  "themeRemove.notPresent": "⚠️ Das Thema **{theme}** ist nicht aktiv.",
  "themeRemove.removed": "✅ Thema **{theme}** entfernt. Aktive Themen: {themes}.",

  "schedule.themes": "🏷️ Themen",
  "schedule.allThemes": "Alle",
  "schedule.quizHours": "🧠 Geplante Quiz",

  "quiz.title": "🧠 Quiz",
  "quiz.footer": "Du hast 1 Minute zum Antworten",
  "quiz.correct": "✅ Richtig! {explanation}",
  "quiz.incorrect": "❌ Falsche Antwort. Die richtige Antwort war: **{answer}**.\n{explanation}",
  "quiz.reveal": "✅ Antwort: **{answer}**",
  "quiz.failed": "❌ Quiz konnte nicht erstellt werden. Versuche es später erneut.",

  "quizHour.exists": "⚠️ Die Quiz-Uhrzeit {hour}:00 Uhr ist bereits konfiguriert.",
  "quizHour.added": "✅ Quiz-Uhrzeit {hour}:00 Uhr hinzugefügt. Geplante Quiz: {hours}.",
  "quizHour.notPresent": "⚠️ Die Quiz-Uhrzeit {hour}:00 Uhr ist nicht konfiguriert.",
  "quizHour.removed": "✅ Quiz-Uhrzeit {hour}:00 Uhr entfernt. Geplante Quiz: {hours}.",
  "quizHour.emptied": "✅ Quiz-Uhrzeit {hour}:00 Uhr entfernt. Keine geplanten Quiz mehr.",

  "history.title": "📜 Anekdoten-Verlauf",
  "history.empty": "📭 Auf diesem Server wurde noch keine Anekdote gesendet.",
  "history.footer": "Seite {page}/{pages} · {total} Anekdote(n)",

  "level.up": "🎉 <@{user}> erreicht Level **{level}**!",
  "level.title": "📊 Statistiken von {user}",
  "level.level": "🏆 Level",
  "level.xp": "✨ XP",
  "level.quiz": "🧠 Quiz (richtig / beantwortet)",
  "level.notInGuild": "❌ Level sind nur auf einem Server verfügbar.",

  "leaderboard.xpTitle": "🏆 XP-Rangliste",
  "leaderboard.quizTitle": "🧠 Quiz-Rangliste",
  "leaderboard.empty": "Auf diesem Server hat noch niemand XP gesammelt.",
  "leaderboard.quizEmpty": "Auf diesem Server hat noch niemand ein Quiz beantwortet.",
  "leaderboard.xpLine": "**{rank}.** <@{user}> · Level {level} ({xp} XP)",
  "leaderboard.quizLine": "**{rank}.** <@{user}> · {correct} richtig / {answered}",

  "recap.title": "🏆 Anekdote der Woche",
  "recap.description": "Die beliebteste Anekdote der letzten 7 Tage ({up} 👍 / {down} 👎):\n\n**{title}**\n[Nachricht ansehen]({url})",
};
