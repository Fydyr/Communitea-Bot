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
};
