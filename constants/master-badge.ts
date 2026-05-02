/**
 * Main achievement: earned when every sutra in the live catalog is fully completed.
 * Derived from `completed` vs `/sutras` IDs (new sutras later revoke until mastered).
 */

export const MASTER_BADGE = {
  emoji: '💠',
  title: 'Jewel of the Complete Path',
  subtitle: 'You mastered every sutra in Jain Shala.',
  ribbon: 'Main badge',
} as const;

export function hasEarnedMasterBadge(catalogIds: string[], completedIds: readonly string[]): boolean {
  if (!catalogIds.length) return false;
  const done = new Set(completedIds);
  return catalogIds.every(id => done.has(id));
}

/** Same check but treat `extraCompletedId` as done even if not yet in `completedIds` (e.g. completion screen race). */
export function hasEarnedMasterBadgeWithPending(
  catalogIds: string[],
  completedIds: readonly string[],
  extraCompletedId: string | undefined,
): boolean {
  if (!catalogIds.length) return false;
  const done = new Set(completedIds);
  if (extraCompletedId) done.add(extraCompletedId);
  return catalogIds.every(id => done.has(id));
}
