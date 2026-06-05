export type SutraProgress = {
  read: boolean;
  listen: boolean;
  learn: boolean;
  learn_fill: boolean;
  recite: boolean;
};

/**
 * Calculates user score/devotional points based on:
 * - 50 points per fully completed (mastered) sutra
 * - 10 points per step completed for partially done sutras
 */
export function calculateScore(
  completedSutras: string[] | undefined | null,
  progressDetails: Record<string, SutraProgress | any> | undefined | null
): number {
  const completed = completedSutras || [];
  const details = progressDetails || {};
  const completedSet = new Set(completed);

  let score = completedSet.size * 50;

  const steps = ['read', 'listen', 'learn', 'learn_fill', 'recite'] as const;

  Object.entries(details).forEach(([sutraId, sutraProgress]) => {
    // If it's already counted as a fully completed sutra, don't count steps
    if (completedSet.has(sutraId)) return;

    if (sutraProgress && typeof sutraProgress === 'object') {
      steps.forEach((step) => {
        if (sutraProgress[step] === true) {
          score += 10;
        }
      });
    }
  });

  return score;
}
