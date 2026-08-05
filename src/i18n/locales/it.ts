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

  "translate.title": "🌍 Traduzione in {language}",
  "translate.footer": "Tradotto automaticamente",

  "about.failed": "❌ Impossibile generare un aneddoto su questo argomento. Riprova più tardi.",

  "theme.langages": "Linguaggi di programmazione",
  "theme.entreprises": "Aziende tech",
  "theme.personnalites": "Personalità tech",
  "theme.jeux-video": "Videogiochi",
  "theme.securite": "Cybersicurezza",
  "theme.hardware": "Hardware informatico",
  "theme.web": "Web e internet",
  "theme.ia": "Intelligenza artificiale",
  "theme.histoire": "Storia dell'informatica",

  "themeAdd.invalid": "❌ Tema sconosciuto.",
  "themeAdd.exists": "⚠️ Il tema **{theme}** è già attivo.",
  "themeAdd.added": "✅ Tema **{theme}** aggiunto. Temi attivi: {themes}.",
  "themeRemove.notPresent": "⚠️ Il tema **{theme}** non è attivo.",
  "themeRemove.removed": "✅ Tema **{theme}** rimosso. Temi attivi: {themes}.",

  "schedule.themes": "🏷️ Temi",
  "schedule.allThemes": "Tutti",
  "schedule.quizHours": "🧠 Quiz programmati",

  "quiz.title": "🧠 Quiz",
  "quiz.footer": "Hai {minutes} min per rispondere",
  "quiz.correct": "✅ Risposta corretta! {explanation}",
  "quiz.incorrect": "❌ Risposta sbagliata. La risposta corretta era: **{answer}**.\n{explanation}",
  "quiz.reveal": "✅ Risposta: **{answer}**",
  "quiz.failed": "❌ Impossibile generare un quiz. Riprova più tardi.",

  "quizHour.exists": "⚠️ L'ora del quiz {hour}:00 è già configurata.",
  "quizHour.added": "✅ Ora del quiz {hour}:00 aggiunta. Quiz programmati: {hours}.",
  "quizHour.notPresent": "⚠️ L'ora del quiz {hour}:00 non è configurata.",
  "quizHour.removed": "✅ Ora del quiz {hour}:00 rimossa. Quiz programmati: {hours}.",
  "quizHour.emptied": "✅ Ora del quiz {hour}:00 rimossa. Nessun quiz programmato.",

  "history.title": "📜 Cronologia degli aneddoti",
  "history.empty": "📭 Nessun aneddoto è ancora stato inviato su questo server.",
  "history.footer": "Pagina {page}/{pages} · {total} aneddoto/i",

  "level.up": "🎉 <@{user}> sale al livello **{level}**!",
  "level.title": "📊 Statistiche di {user}",
  "level.level": "🏆 Livello",
  "level.xp": "✨ XP",
  "level.quiz": "🧠 Quiz (corrette / risposte)",
  "level.notInGuild": "❌ I livelli sono disponibili solo in un server.",

  "leaderboard.xpTitle": "🏆 Classifica XP",
  "leaderboard.quizTitle": "🧠 Classifica Quiz",
  "leaderboard.empty": "Nessuno ha ancora guadagnato XP in questo server.",
  "leaderboard.quizEmpty": "Nessuno ha ancora risposto a un quiz in questo server.",
  "leaderboard.xpLine": "**{rank}.** <@{user}> · livello {level} ({xp} XP)",
  "leaderboard.quizLine": "**{rank}.** <@{user}> · {correct} corrette / {answered}",

  "recap.title": "🏆 Aneddoto della settimana",
  "recap.description": "L'aneddoto più apprezzato degli ultimi 7 giorni ({up} 👍 / {down} 👎):\n\n**{title}**\n[Vedi il messaggio]({url})",

  "newsSetup.created": "✅ Le news saranno inviate in <#{channel}>{roleSuffix}.",
  "newsSetup.updated": "✅ Configurazione delle news aggiornata per <#{channel}>{roleSuffix}.",
  "newsSetup.error": "❌ Si è verificato un errore durante la configurazione delle news.",

  "newsRemove.success": "✅ Il canale <#{channel}> non riceverà più news.",
  "newsRemove.notConfigured": "⚠️ Il canale <#{channel}> non era configurato per le news.",

  "newsList.empty": "📭 Nessun canale è configurato per le news su questo server.\nUsa `/news-setup` per configurarne uno.",
  "newsList.title": "📰 Canali di news configurati",
  "newsList.footer": "{count} canale/i configurato/i",

  "newsHour.added": "✅ Orario news {hour}:00 aggiunto. News programmate: {hours}.",
  "newsHour.exists": "⚠️ L'orario news {hour}:00 è già configurato.",
  "newsHour.notPresent": "⚠️ L'orario news {hour}:00 non è configurato.",
  "newsHour.removed": "✅ Orario news {hour}:00 rimosso. News programmate: {hours}.",
  "newsHour.emptied": "✅ Orario news {hour}:00 rimosso. Nessuna news programmata.",

  "news.title": "📰 Attualità tech del {date}",
  "news.footer": "Fonti: {sources}",
  "news.degraded": "⚠️ Riassunti automatici non disponibili: vengono mostrati solo titoli e link.",
  "news.unverified": "⚠️ Generato senza ricerca web: verifica le fonti prima di condividere.",
  "news.failed": "❌ Impossibile recuperare le news. Riprova più tardi.",
  "news.noChannel": "❌ Nessun canale è configurato per le news su questo server.\nUsa `/news-setup` per configurarne uno.",
  "news.success": "✅ News inviate in: {channels}",

  "schedule.newsHours": "📰 News programmate",
};
