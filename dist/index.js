"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
require("reflect-metadata");
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const config_1 = require("./config");
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
exports.bot = new discordx_1.Client({
    intents: [
        discord_js_1.IntentsBitField.Flags.Guilds,
        discord_js_1.IntentsBitField.Flags.GuildMembers,
        discord_js_1.IntentsBitField.Flags.GuildMessages,
        discord_js_1.IntentsBitField.Flags.MessageContent,
    ],
    silent: false,
    botGuilds: config_1.config.guildId ? [config_1.config.guildId] : undefined,
});
exports.bot.once("ready", async () => {
    await exports.bot.clearApplicationCommands();
    await exports.bot.initApplicationCommands();
    console.log(`Bot ${exports.bot.user?.tag} is ready!`);
});
exports.bot.on("interactionCreate", (interaction) => {
    exports.bot.executeInteraction(interaction);
});
async function run() {
    // Import all controllers
    const controllersPath = path_1.default.join(__dirname, "controllers", "**", "*.js").replace(/\\/g, "/");
    const files = (0, glob_1.globSync)(controllersPath);
    for (const file of files) {
        require(file);
    }
    if (!config_1.config.token) {
        throw new Error("DISCORD_TOKEN is not set in .env file");
    }
    await exports.bot.login(config_1.config.token);
}
run();
//# sourceMappingURL=index.js.map