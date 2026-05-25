/**
 * Deterministic badge flair per sutra id — stable across sessions/devices for the same id.
 */

const PREFIXES = [
  'Radiant',
  'Sacred',
  'Steadfast',
  'Gentle',
  'Bright',
  'Quiet',
  'Devoted',
  'Mindful',
  'Golden',
  'Clear',
  'Humble',
  'Noble',
  'Pure',
  'Deep',
  'True',
];

const ROOTS = [
  'Seeker',
  'Scholar',
  'Quiz',
  'Path',
  'Light',
  'Jewel',
  'Heart',
  'Step',
  'Flame',
  'Bloom',
  'River',
  'Star',
  'Song',
  'Trust',
  'Key',
];

const GLYPHS = ['🏅', '🪷', '✨', '📿', '🙏', '💠', '🔔', '🌸', '⭐', '🕊️', '🌿', '☸️'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export type SutraBadgeFlair = {
  /** Distinct label shown as the badge name (paired with sutra title for uniqueness). */
  epithet: string;
  emoji: string;
};

export function getSutraBadgeFlair(sutraId: string): SutraBadgeFlair {
  const h = hashString(sutraId);
  const epithet = `${PREFIXES[h % PREFIXES.length]} ${ROOTS[(h >>> 8) % ROOTS.length]}`;
  const emoji = GLYPHS[h % GLYPHS.length];
  return { epithet, emoji };
}
