import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction } from "discord.js";
import { AnecdoteService } from "../services/AnecdoteService";

@Discord()
export class AnecdoteController {
  @Slash({ description: "Envoie immédiatement une anecdote informatique dans le canal configuré", name: "send-anecdote" })
  async sendAnecdote(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      await AnecdoteService.sendDailyAnecdote();
      await interaction.editReply("✅ Anecdote envoyée avec succès !");
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'anecdote:", error);
      await interaction.editReply("❌ Erreur lors de l'envoi de l'anecdote. Vérifiez les logs.");
    }
  }
}
