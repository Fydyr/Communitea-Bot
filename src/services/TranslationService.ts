import axios from "axios";
import { LoggerService } from "./LoggerService";
import { GeminiService } from "./GeminiService";
import type { FlagLanguage } from "./flagLanguages";

export class TranslationService {
  private static readonly MYMEMORY_API = "https://api.mymemory.translated.net/get";

  /**
   * Traduit un texte vers la langue cible (issue d'un drapeau).
   * Utilise Gemini (détection auto de la source, n'importe quelle cible) avec
   * MyMemory en fallback pour le français. Renvoie null si tout échoue.
   */
  public static async translate(text: string, target: FlagLanguage): Promise<string | null> {
    const viaGemini = await GeminiService.translate(text, target.name);
    if (viaGemini) {
      return viaGemini;
    }

    // Fallback : MyMemory ne sait traduire de façon fiable que vers le français ici.
    if (target.code === "fr") {
      const viaMyMemory = await this.translateToFrench(text);
      if (viaMyMemory && viaMyMemory !== text) {
        return viaMyMemory;
      }
    }

    return null;
  }

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
