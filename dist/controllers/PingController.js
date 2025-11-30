"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingController = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const PingService_1 = require("../services/PingService");
const index_1 = require("../index");
let PingController = class PingController {
    pingService = new PingService_1.PingService();
    async ping(interaction) {
        const start = Date.now();
        await interaction.deferReply();
        const latency = Date.now() - start;
        const apiLatency = Math.round(index_1.bot.ws.ping);
        await interaction.editReply(`Pong! Latence: **${latency}ms** | API: **${apiLatency}ms**`);
    }
};
exports.PingController = PingController;
__decorate([
    (0, discordx_1.Slash)({ description: "Test la latence du bot", name: "ping" }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], PingController.prototype, "ping", null);
exports.PingController = PingController = __decorate([
    (0, discordx_1.Discord)()
], PingController);
//# sourceMappingURL=PingController.js.map