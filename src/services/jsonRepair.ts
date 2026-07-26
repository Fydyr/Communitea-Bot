/**
 * Tente de réparer un JSON malformé retourné par Gemini.
 */
export function repairJson(json: string): string {
  let fixed = json;
  // Supprimer les virgules en trop avant ] ou }
  fixed = fixed.replace(/,\s*([\]}])/g, "$1");
  // Supprimer les caractères de contrôle non échappés dans les strings
  fixed = fixed.replace(/(?<=:\s*"(?:[^"\\]|\\.)*)[\x00-\x1f](?=[^"]*")/g, " ");
  // Remplacer les sauts de ligne non échappés dans les valeurs string
  fixed = fixed.replace(/"([^"]*?)"/g, (_match, content: string) => {
    return `"${content.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
  });
  return fixed;
}
