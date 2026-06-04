export type SutraLine = {
  line_number: number;
  transliteration: string;
  translation_en: string;
  tts_devanagari?: string;
};

export type Sutra = {
  id: string;
  title: string;
  category: string;
  sutra_number: number;
  original_gu?: string;
  original_hi?: string;
  lines: SutraLine[];
  interpretation: string;
  tags: string[];
  badgeEpithet?: string;
  badgeEmoji?: string;
};
