import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { WeatherService } from "../services/WeatherService";

@Discord()
export class WeatherController {
  private weatherService = new WeatherService();

  @Slash({ description: "Affiche la météo d'une ville", name: "meteo" })
  async weather(
    @SlashOption({
      description: "Nom de la ville",
      name: "ville",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    city: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();

    try {
      const weatherData = await this.weatherService.getWeather(city);
      const emoji = this.weatherService.getWeatherEmoji(
        weatherData.weather[0].main
      );

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(
          `${emoji} Météo à ${weatherData.name}, ${weatherData.sys.country}`
        )
        .setDescription(weatherData.weather[0].description)
        .addFields(
          {
            name: "🌡️ Température",
            value: `${Math.round(weatherData.main.temp)}°C`,
            inline: true,
          },
          {
            name: "🤔 Ressenti",
            value: `${Math.round(weatherData.main.feels_like)}°C`,
            inline: true,
          },
          {
            name: "💧 Humidité",
            value: `${weatherData.main.humidity}%`,
            inline: true,
          },
          {
            name: "💨 Vent",
            value: `${Math.round(weatherData.wind.speed * 3.6)} km/h`,
            inline: true,
          },
          {
            name: "🔽 Pression",
            value: `${weatherData.main.pressure} hPa`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Données fournies par OpenWeatherMap" });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Erreur : ${error.message}`,
      });
    }
  }
}
