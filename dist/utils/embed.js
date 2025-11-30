"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmbed = createEmbed;
exports.createErrorEmbed = createErrorEmbed;
exports.createSuccessEmbed = createSuccessEmbed;
const discord_js_1 = require("discord.js");
function createEmbed(title, description, color = "#5865F2") {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
}
function createErrorEmbed(message) {
    return createEmbed("Erreur", message, "#ED4245");
}
function createSuccessEmbed(message) {
    return createEmbed("Succès", message, "#57F287");
}
//# sourceMappingURL=embed.js.map