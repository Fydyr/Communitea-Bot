"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    token: process.env.DISCORD_TOKEN || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
    clientId: process.env.CLIENT_ID || "",
};
//# sourceMappingURL=index.js.map