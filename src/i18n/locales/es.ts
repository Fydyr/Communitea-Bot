import type { MessageKey } from "./fr";

export const es: Record<MessageKey, string> = {
  "common.notInGuild": "❌ Este comando debe usarse en un servidor.",
  "common.error": "❌ Se ha producido un error.",

  "setup.updated": "✅ Configuración actualizada para <#{channel}>{roleSuffix}.",
  "setup.created": "✅ Las anécdotas se enviarán a <#{channel}>{roleSuffix}.",
  "setup.roleSuffix": " mencionando a <@&{role}>",
  "setup.error": "❌ Se ha producido un error durante la configuración.",

  "remove.success": "✅ El canal <#{channel}> ya no recibirá anécdotas.",
  "remove.notConfigured": "⚠️ El canal <#{channel}> no estaba configurado para las anécdotas.",
  "remove.error": "❌ Se ha producido un error al eliminar la configuración.",

  "list.empty": "📭 Ningún canal está configurado para las anécdotas en este servidor.\nUsa `/setup` para configurar uno.",
  "list.title": "📚 Canales de anécdotas configurados",
  "list.footer": "{count} canal(es) configurado(s)",

  "send.noPermission": "❌ No tienes permiso para usar este comando.",
  "send.noChannel": "❌ Ningún canal está configurado para las anécdotas en este servidor.\nUsa `/setup` para configurar uno.",
  "send.success": "✅ Anécdota enviada a: {channels}",
  "send.error": "❌ Error al enviar la anécdota. Consulta los registros.",

  "stats.title": "📊 Estadísticas de las anécdotas",
  "stats.sent": "📤 Anécdotas enviadas",
  "stats.channelsGlobal": "🌐 Canales (global)",
  "stats.channelsGuild": "📍 Canales (este servidor)",

  "hourAdd.invalid": "❌ La hora debe ser un número entero entre 0 y 23.",
  "hourAdd.exists": "⚠️ La hora {hour}:00 ya está configurada.",
  "hourAdd.added": "✅ Hora {hour}:00 añadida. Horas de envío: {hours}.",

  "hourRemove.notPresent": "⚠️ La hora {hour}:00 no está configurada.",
  "hourRemove.removed": "✅ Hora {hour}:00 eliminada. Horas de envío: {hours}.",
  "hourRemove.emptied": "✅ Hora {hour}:00 eliminada. Ya no hay ninguna hora configurada: este servidor ya no recibirá anécdotas automáticas (el envío manual sigue funcionando).",

  "schedule.title": "🗓️ Horario de las anécdotas",
  "schedule.hours": "🕐 Horas de envío",
  "schedule.timezone": "🌍 Zona horaria",
  "schedule.language": "🗣️ Idioma",
  "schedule.noHours": "Ninguna (envíos automáticos desactivados)",
  "schedule.defaultNote": "ℹ️ Valores por defecto (sin configuración personalizada).",

  "timezone.invalid": "❌ Zona horaria no válida. Ejemplo: `Europe/Paris`.",
  "timezone.success": "✅ Zona horaria configurada en `{timezone}`.",

  "language.success": "✅ Idioma configurado en **{language}**.",
};
