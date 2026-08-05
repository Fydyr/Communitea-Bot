export const fr = {
  "common.notInGuild": "❌ Cette commande doit être utilisée dans un serveur.",
  "common.error": "❌ Une erreur est survenue.",

  "setup.updated": "✅ Configuration mise à jour pour <#{channel}>{roleSuffix}.",
  "setup.created": "✅ Les anecdotes seront envoyées dans <#{channel}>{roleSuffix}.",
  "setup.roleSuffix": " avec mention de <@&{role}>",
  "setup.error": "❌ Une erreur est survenue lors de la configuration.",

  "remove.success": "✅ Le channel <#{channel}> ne recevra plus d'anecdotes.",
  "remove.notConfigured": "⚠️ Le channel <#{channel}> n'était pas configuré pour les anecdotes.",
  "remove.error": "❌ Une erreur est survenue lors de la suppression.",

  "list.empty": "📭 Aucun channel n'est configuré pour les anecdotes sur ce serveur.\nUtilise `/setup` pour en configurer un.",
  "list.title": "📚 Channels d'anecdotes configurés",
  "list.footer": "{count} channel(s) configuré(s)",

  "send.noPermission": "❌ Tu n'as pas la permission d'utiliser cette commande.",
  "send.noChannel": "❌ Aucun channel n'est configuré pour les anecdotes sur ce serveur.\nUtilise `/setup` pour en configurer un.",
  "send.success": "✅ Anecdote envoyée dans : {channels}",
  "send.error": "❌ Erreur lors de l'envoi de l'anecdote. Vérifiez les logs.",

  "stats.title": "📊 Statistiques des anecdotes",
  "stats.sent": "📤 Anecdotes envoyées",
  "stats.channelsGlobal": "🌐 Channels (global)",
  "stats.channelsGuild": "📍 Channels (ce serveur)",

  "hourAdd.invalid": "❌ L'heure doit être un entier entre 0 et 23.",
  "hourAdd.exists": "⚠️ L'heure {hour}h est déjà configurée.",
  "hourAdd.added": "✅ Heure {hour}h ajoutée. Heures d'envoi : {hours}.",

  "hourRemove.notPresent": "⚠️ L'heure {hour}h n'est pas configurée.",
  "hourRemove.removed": "✅ Heure {hour}h retirée. Heures d'envoi : {hours}.",
  "hourRemove.emptied": "✅ Heure {hour}h retirée. Plus aucune heure n'est configurée : ce serveur ne recevra plus d'anecdotes automatiques (l'envoi manuel reste possible).",

  "schedule.title": "🗓️ Horaire des anecdotes",
  "schedule.hours": "🕐 Heures d'envoi",
  "schedule.timezone": "🌍 Fuseau horaire",
  "schedule.language": "🗣️ Langue",
  "schedule.noHours": "Aucune (envois automatiques désactivés)",
  "schedule.defaultNote": "ℹ️ Valeurs par défaut (aucune configuration personnalisée).",

  "timezone.invalid": "❌ Fuseau horaire invalide. Exemple : `Europe/Paris`.",
  "timezone.success": "✅ Fuseau horaire défini sur `{timezone}`.",

  "language.success": "✅ Langue définie sur **{language}**.",

  "translate.title": "🌍 Traduction en {language}",
  "translate.footer": "Traduit automatiquement",

  "about.failed": "❌ Impossible de générer une anecdote sur ce sujet. Réessaie plus tard.",

  "theme.langages": "Langages de programmation",
  "theme.entreprises": "Entreprises tech",
  "theme.personnalites": "Personnalités tech",
  "theme.jeux-video": "Jeux vidéo",
  "theme.securite": "Cybersécurité",
  "theme.hardware": "Matériel informatique",
  "theme.web": "Web et internet",
  "theme.ia": "Intelligence artificielle",
  "theme.histoire": "Histoire de l'informatique",

  "themeAdd.invalid": "❌ Thème inconnu.",
  "themeAdd.exists": "⚠️ Le thème **{theme}** est déjà actif.",
  "themeAdd.added": "✅ Thème **{theme}** ajouté. Thèmes actifs : {themes}.",
  "themeRemove.notPresent": "⚠️ Le thème **{theme}** n'est pas actif.",
  "themeRemove.removed": "✅ Thème **{theme}** retiré. Thèmes actifs : {themes}.",

  "schedule.themes": "🏷️ Thèmes",
  "schedule.allThemes": "Tous",
  "schedule.quizHours": "🧠 Quiz programmés",

  "quiz.title": "🧠 Quiz",
  "quiz.footer": "Tu as {minutes} min pour répondre",
  "quiz.correct": "✅ Bonne réponse ! {explanation}",
  "quiz.incorrect": "❌ Mauvaise réponse. La bonne réponse était : **{answer}**.\n{explanation}",
  "quiz.reveal": "✅ Réponse : **{answer}**",
  "quiz.failed": "❌ Impossible de générer un quiz. Réessaie plus tard.",

  "quizHour.exists": "⚠️ L'heure de quiz {hour}h est déjà configurée.",
  "quizHour.added": "✅ Heure de quiz {hour}h ajoutée. Quiz programmés : {hours}.",
  "quizHour.notPresent": "⚠️ L'heure de quiz {hour}h n'est pas configurée.",
  "quizHour.removed": "✅ Heure de quiz {hour}h retirée. Quiz programmés : {hours}.",
  "quizHour.emptied": "✅ Heure de quiz {hour}h retirée. Plus aucun quiz programmé.",

  "history.title": "📜 Historique des anecdotes",
  "history.empty": "📭 Aucune anecdote n'a encore été envoyée sur ce serveur.",
  "history.footer": "Page {page}/{pages} · {total} anecdote(s)",

  "level.up": "🎉 <@{user}> passe au niveau **{level}** !",
  "level.title": "📊 Statistiques de {user}",
  "level.level": "🏆 Niveau",
  "level.xp": "✨ XP",
  "level.quiz": "🧠 Quiz (corrects / répondus)",
  "level.notInGuild": "❌ Les niveaux ne sont disponibles que sur un serveur.",

  "leaderboard.xpTitle": "🏆 Classement XP",
  "leaderboard.quizTitle": "🧠 Classement Quiz",
  "leaderboard.empty": "Personne n'a encore gagné d'XP sur ce serveur.",
  "leaderboard.quizEmpty": "Personne n'a encore répondu à un quiz sur ce serveur.",
  "leaderboard.xpLine": "**{rank}.** <@{user}> · niveau {level} ({xp} XP)",
  "leaderboard.quizLine": "**{rank}.** <@{user}> · {correct} bonnes réponses / {answered}",

  "recap.title": "🏆 Anecdote de la semaine",
  "recap.description": "L'anecdote la plus appréciée des 7 derniers jours ({up} 👍 / {down} 👎) :\n\n**{title}**\n[Voir le message]({url})",

  "newsSetup.created": "✅ Les news seront envoyées dans <#{channel}>{roleSuffix}.",
  "newsSetup.updated": "✅ Configuration des news mise à jour pour <#{channel}>{roleSuffix}.",
  "newsSetup.error": "❌ Une erreur est survenue lors de la configuration des news.",

  "newsRemove.success": "✅ Le channel <#{channel}> ne recevra plus de news.",
  "newsRemove.notConfigured": "⚠️ Le channel <#{channel}> n'était pas configuré pour les news.",

  "newsList.empty": "📭 Aucun channel n'est configuré pour les news sur ce serveur.\nUtilise `/news-setup` pour en configurer un.",
  "newsList.title": "📰 Channels de news configurés",
  "newsList.footer": "{count} channel(s) configuré(s)",

  "newsHour.added": "✅ Heure de news {hour}h ajoutée. News programmées : {hours}.",
  "newsHour.exists": "⚠️ L'heure de news {hour}h est déjà configurée.",
  "newsHour.notPresent": "⚠️ L'heure de news {hour}h n'est pas configurée.",
  "newsHour.removed": "✅ Heure de news {hour}h retirée. News programmées : {hours}.",
  "newsHour.emptied": "✅ Heure de news {hour}h retirée. Plus aucune news programmée.",

  "news.title": "📰 Actu tech du {date}",
  "news.footer": "Sources : {sources}",
  "news.degraded": "⚠️ Résumés automatiques indisponibles : seuls les titres et les liens sont affichés.",
  "news.unverified": "⚠️ Contenu généré sans recherche web : vérifie les sources avant de le relayer.",
  "news.failed": "❌ Impossible de récupérer les news. Réessaie plus tard.",
  "news.noChannel": "❌ Aucun channel n'est configuré pour les news sur ce serveur.\nUtilise `/news-setup` pour en configurer un.",
  "news.success": "✅ News envoyées dans : {channels}",

  "schedule.newsHours": "📰 News programmées",
} as const;

export type MessageKey = keyof typeof fr;
