export function getSutraBadgeAbout(unlocked: boolean): string {
  if (unlocked) {
    return 'You earned this badge by completing all five steps for this sutra: read, listen, meaning quiz, fill-in-the-blanks, and sequence order.';
  }
  return 'Unlock this badge by finishing every learning step for this sutra — read, listen, quiz, fill-in, and order.';
}

export function getMasterBadgeAbout(unlocked: boolean): string {
  if (unlocked) {
    return 'You mastered every sutra on the Jain Shala path. This jewel marks full dedication across the entire catalog.';
  }
  return 'Earn every individual sutra badge below to unlock the Jewel of the Complete Path — the highest honor in Jain Shala.';
}
