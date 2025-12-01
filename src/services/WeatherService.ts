import axios from "axios";
import { config } from "../config";

interface WeatherData {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    description: string;
    main: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  sys: {
    country: string;
  };
}

export class WeatherService {
  private readonly BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

  async getWeather(city: string): Promise<WeatherData> {
    if (!config.weatherApiKey) {
      throw new Error("La clé API météo n'est pas configurée");
    }

    try {
      const response = await axios.get<WeatherData>(this.BASE_URL, {
        params: {
          q: city,
          appid: config.weatherApiKey,
          units: "metric",
          lang: "fr",
        },
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error("Ville introuvable");
      }
      if (error.response?.status === 401) {
        throw new Error("Clé API invalide");
      }
      throw new Error("Erreur lors de la récupération des données météo");
    }
  }

  getWeatherEmoji(weatherMain: string): string {
    const emojiMap: Record<string, string> = {
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
