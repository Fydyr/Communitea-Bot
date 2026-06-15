import type { MessageKey } from "./fr";

export const en: Record<MessageKey, string> = {
  "common.notInGuild": "❌ This command must be used in a server.",
  "common.error": "❌ An error occurred.",

  "setup.updated": "✅ Configuration updated for <#{channel}>{roleSuffix}.",
  "setup.created": "✅ Anecdotes will be sent to <#{channel}>{roleSuffix}.",
  "setup.roleSuffix": " mentioning <@&{role}>",
  "setup.error": "❌ An error occurred during configuration.",

  "remove.success": "✅ The channel <#{channel}> will no longer receive anecdotes.",
  "remove.notConfigured": "⚠️ The channel <#{channel}> was not configured for anecdotes.",
  "remove.error": "❌ An error occurred while removing the configuration.",

  "list.empty": "📭 No channel is configured for anecdotes on this server.\nUse `/setup` to configure one.",
  "list.title": "📚 Configured anecdote channels",
  "list.footer": "{count} channel(s) configured",

  "send.noPermission": "❌ You don't have permission to use this command.",
  "send.noChannel": "❌ No channel is configured for anecdotes on this server.\nUse `/setup` to configure one.",
  "send.success": "✅ Anecdote sent to: {channels}",
  "send.error": "❌ Error while sending the anecdote. Check the logs.",

  "stats.title": "📊 Anecdote statistics",
  "stats.sent": "📤 Anecdotes sent",
  "stats.channelsGlobal": "🌐 Channels (global)",
  "stats.channelsGuild": "📍 Channels (this server)",

  "hourAdd.invalid": "❌ The hour must be an integer between 0 and 23.",
  "hourAdd.exists": "⚠️ The hour {hour}:00 is already configured.",
  "hourAdd.added": "✅ Hour {hour}:00 added. Sending hours: {hours}.",

  "hourRemove.notPresent": "⚠️ The hour {hour}:00 is not configured.",
  "hourRemove.removed": "✅ Hour {hour}:00 removed. Sending hours: {hours}.",
  "hourRemove.emptied": "✅ Hour {hour}:00 removed. No hours are configured anymore: this server will no longer receive automatic anecdotes (manual sending still works).",

  "schedule.title": "🗓️ Anecdote schedule",
  "schedule.hours": "🕐 Sending hours",
  "schedule.timezone": "🌍 Time zone",
  "schedule.language": "🗣️ Language",
  "schedule.noHours": "None (automatic sending disabled)",
  "schedule.defaultNote": "ℹ️ Default values (no custom configuration).",

  "timezone.invalid": "❌ Invalid time zone. Example: `Europe/Paris`.",
  "timezone.success": "✅ Time zone set to `{timezone}`.",

  "language.success": "✅ Language set to **{language}**.",

  "translate.title": "🌍 Translation to {language}",
  "translate.footer": "Automatically translated",

  "about.failed": "❌ Couldn't generate an anecdote on this topic. Try again later.",

  "theme.langages": "Programming languages",
  "theme.entreprises": "Tech companies",
  "theme.personnalites": "Tech figures",
  "theme.jeux-video": "Video games",
  "theme.securite": "Cybersecurity",
  "theme.hardware": "Computer hardware",
  "theme.web": "Web and internet",
  "theme.ia": "Artificial intelligence",
  "theme.histoire": "Computing history",

  "themeAdd.invalid": "❌ Unknown theme.",
  "themeAdd.exists": "⚠️ The theme **{theme}** is already active.",
  "themeAdd.added": "✅ Theme **{theme}** added. Active themes: {themes}.",
  "themeRemove.notPresent": "⚠️ The theme **{theme}** is not active.",
  "themeRemove.removed": "✅ Theme **{theme}** removed. Active themes: {themes}.",

  "schedule.themes": "🏷️ Themes",
  "schedule.allThemes": "All",
  "schedule.quizHours": "🧠 Scheduled quizzes",

  "quiz.title": "🧠 Quiz",
  "quiz.footer": "You have 1 minute to answer",
  "quiz.correct": "✅ Correct! {explanation}",
  "quiz.incorrect": "❌ Wrong answer. The correct answer was: **{answer}**.\n{explanation}",
  "quiz.reveal": "✅ Answer: **{answer}**",
  "quiz.failed": "❌ Couldn't generate a quiz. Try again later.",

  "quizHour.exists": "⚠️ The quiz hour {hour}:00 is already configured.",
  "quizHour.added": "✅ Quiz hour {hour}:00 added. Scheduled quizzes: {hours}.",
  "quizHour.notPresent": "⚠️ The quiz hour {hour}:00 is not configured.",
  "quizHour.removed": "✅ Quiz hour {hour}:00 removed. Scheduled quizzes: {hours}.",
  "quizHour.emptied": "✅ Quiz hour {hour}:00 removed. No more scheduled quizzes.",

  "history.title": "📜 Anecdote history",
  "history.empty": "📭 No anecdote has been sent on this server yet.",
  "history.footer": "Page {page}/{pages} · {total} anecdote(s)",
};
