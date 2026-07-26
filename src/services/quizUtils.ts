/**
 * Mélange les options d'un quiz (Fisher-Yates) et renvoie le nouvel index de
 * la bonne réponse. Gemini plaçant presque toujours la bonne réponse en A/B,
 * ce mélange la répartit sur les 4 positions.
 */
export function shuffleQuizOptions(
  options: string[],
  correctIndex: number
): { options: string[]; correctIndex: number } {
  const shuffled = [...options];
  const correctAnswer = shuffled[correctIndex];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { options: shuffled, correctIndex: shuffled.indexOf(correctAnswer) };
}
