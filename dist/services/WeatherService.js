"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
class WeatherService {
    BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
    async getWeather(city) {
        if (!config_1.config.weatherApiKey) {
            throw new Error("La clé API météo n'est pas configurée");
        }
        try {
            const response = await axios_1.default.get(this.BASE_URL, {
                params: {
                    q: city,
                    appid: config_1.config.weatherApiKey,
                    units: "metric",
                    lang: "fr",
                },
            });
            return response.data;
        }
        catch (error) {
            if (error.response?.status === 404) {
                throw new Error("Ville introuvable");
            }
            if (error.response?.status === 401) {
                throw new Error("Clé API invalide");
            }
            throw new Error("Erreur lors de la récupération des données météo");
        }
    }
    getWeatherEmoji(weatherMain) {
        const emojiMap = {
            Clear: "☀️",
            Clouds: "☁️",
            Rain: "🌧️",
            Drizzle: "🌦️",
            Thunderstorm: "⛈️",
            Snow: "❄️",
            Mist: "🌫️",
            Fog: "🌫️",
            Haze: "🌫️",
        };
        return emojiMap[weatherMain] || "🌍";
    }
}
exports.WeatherService = WeatherService;
//# sourceMappingURL=WeatherService.js.map