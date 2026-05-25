/** Fisher–Yates shuffle (returns new array). */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build 4 choices: one correct transliteration + 3 distractors from the same sutra. */
export function buildMcqOptions(correct: string, otherTransliterations: string[]): string[] {
  const wrongPool = [...new Set(otherTransliterations.filter(t => t !== correct))];
  const distractors: string[] = [];

  for (const w of shuffle(wrongPool)) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(w)) distractors.push(w);
  }

  let i = 0;
  while (distractors.length < 3 && wrongPool.length > 0) {
    const w = wrongPool[i % wrongPool.length];
    if (w !== correct && !distractors.includes(w)) distractors.push(w);
    i += 1;
    if (i > wrongPool.length * 4) break;
  }

  return shuffle([correct, ...distractors.slice(0, 3)]);
}
