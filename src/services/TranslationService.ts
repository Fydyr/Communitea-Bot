import axios from "axios";
import { LoggerService } from "./LoggerService";

export class TranslationService {
  private static readonly MYMEMORY_API = "https://api.mymemory.translated.net/get";

  /**
   * Traduit un texte de l'anglais vers le français
   * Utilise l'API MyMemory (gratuite, 1000 requêtes/jour)
   */
  public static async translateToFrench(text: string): Promise<string> {
    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      // Limiter la longueur pour éviter les erreurs
      const maxLength = 500;
      let textToTranslate = text;

      if (text.length > maxLength) {
        textToTranslate = text.substring(0, maxLength);
      }

      const response = await axios.get(this.MYMEMORY_API, {
        params: {
          q: textToTranslate,
          langpair: "en|fr",
        },
      });

      if (response.data && response.data.responseData && response.data.responseData.translatedText) {
        return response.data.responseData.translatedText;
      }

      // Si la traduction échoue, retourner le texte original
      return text;
    } catch (error) {
      // En cas d'erreur, retourner le texte original
      await LoggerService.error(`Erreur de traduction: ${error}`);
      return text;
    }
  }

  /**
   * Traduit un tableau de textes en parallèle
   */
  public static async translateMultiple(texts: string[]): Promise<string[]> {
    try {
      const translations = await Promise.all(
        texts.map(text => this.translateToFrench(text))
      );
      return translations;
    } catch (error) {
      await LoggerService.error(`Erreur de traduction multiple: ${error}`);
      return texts;
    }
  }
}
