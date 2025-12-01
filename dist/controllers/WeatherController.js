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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherController = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const WeatherService_1 = require("../services/WeatherService");
let WeatherController = class WeatherController {
    weatherService = new WeatherService_1.WeatherService();
    async weather(city, interaction) {
        await interaction.deferReply();
        try {
            const weatherData = await this.weatherService.getWeather(city);
            const emoji = this.weatherService.getWeatherEmoji(weatherData.weather[0].main);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor("#0099ff")
                .setTitle(`${emoji} Météo à ${weatherData.name}, ${weatherData.sys.country}`)
                .setDescription(weatherData.weather[0].description)
                .addFields({
                name: "🌡️ Température",
                value: `${Math.round(weatherData.main.temp)}°C`,
                inline: true,
            }, {
                name: "🤔 Ressenti",
                value: `${Math.round(weatherData.main.feels_like)}°C`,
                inline: true,
            }, {
                name: "💧 Humidité",
                value: `${weatherData.main.humidity}%`,
                inline: true,
            }, {
                name: "💨 Vent",
                value: `${Math.round(weatherData.wind.speed * 3.6)} km/h`,
                inline: true,
            }, {
                name: "🔽 Pression",
                value: `${weatherData.main.pressure} hPa`,
                inline: true,
            })
                .setTimestamp()
                .setFooter({ text: "Données fournies par OpenWeatherMap" });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ Erreur : ${error.message}`,
            });
        }
    }
};
exports.WeatherController = WeatherController;
__decorate([
    (0, discordx_1.Slash)({ description: "Affiche la météo d'une ville", name: "meteo" }),
    __param(0, (0, discordx_1.SlashOption)({
        description: "Nom de la ville",
        name: "ville",
        required: true,
        type: discord_js_1.ApplicationCommandOptionType.String,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], WeatherController.prototype, "weather", null);
exports.WeatherController = WeatherController = __decorate([
    (0, discordx_1.Discord)()
], WeatherController);
//# sourceMappingURL=WeatherController.js.map