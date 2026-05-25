import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Line = {
  line_number: number;
  transliteration: string;
  translation_en: string;
};

type Sutra = {
  id: string;
  title: string;
  lines: Line[];
};

type BlankSpec = { wordIndex: number; answer: string };

type FillChip = { id: string; word: string };

type FillExercise = {
  line: Line;
  words: string[];
  blanks: BlankSpec[];
  chips: FillChip[];
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function normWord(w: string) {
  return w.toLowerCase().replace(/[^a-z]/gi, '');
}

function blankCountForLine(wordCount: number): number {
  const maxAllowed = Math.max(1, wordCount - 1);
  if (wordCount <= 2) return 1;
  if (wordCount <= 3) return Math.min(2, maxAllowed);
  if (wordCount <= 5) return Math.min(3, maxAllowed);
  if (wordCount <= 7) return Math.min(4, maxAllowed);
  return Math.min(5, maxAllowed);
}

/** Prefer hiding longer tokens — harder to guess from shape alone. */
function pickBlankWordIndices(words: string[], nBlanks: number): number[] {
  const blankCount = Math.min(nBlanks, Math.max(1, words.length - 1));
  const ranked = [...words.keys()].sort((a, b) => {
    const la = normWord(words[a]).length || words[a].length;
    const lb = normWord(words[b]).length || words[b].length;
    return lb - la || a - b;
  });
  return ranked.slice(0, blankCount).sort((a, b) => a - b);
}

function buildFillExercise(lines: Line[]): FillExercise | null {
  const scored = lines.map(line => {
    const words = line.transliteration.trim().split(/\s+/).filter(Boolean);
    return { line, words, score: words.length };
  });
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.filter(s => s.words.length >= 3);
  const pickFrom = candidates.length ? candidates : scored;
  if (!pickFrom.length) return null;

  const { line, words } = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  const nBlanks = blankCountForLine(words.length);
  const positions = pickBlankWordIndices(words, nBlanks);

  const blanks: BlankSpec[] = positions.map(wordIndex => ({
    wordIndex,
    answer: words[wordIndex],
  }));

  const answers = blanks.map(b => b.answer);
  const poolOthers = lines
    .flatMap(l => l.transliteration.trim().split(/\s+/))
    .filter(w => {
      const nw = normWord(w);
      return nw && !answers.some(a => normWord(a) === nw);
    });
  const uniq = [...new Set(poolOthers)];
  const nDistractors = Math.min(
    Math.max(answers.length * 2 + 2, answers.length + 5),
    uniq.length,
  );
  const distractors = shuffle(uniq).slice(0, nDistractors);

  const answerChips: FillChip[] = blanks.map((b, i) => ({
    id: `a-${line.line_number}-${b.wordIndex}-${i}`,
    word: b.answer,
  }));
  const distractorChips: FillChip[] = distractors.map((w, i) => ({
    id: `d-${line.line_number}-${i}`,
    word: w,
  }));

  const chips = shuffle([...answerChips, ...distractorChips]);

  return { line, words, blanks, chips };
}

const ROUNDS_REQUIRED = 3;

export default function LearnBlanksScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [roundsCorrect, setRoundsCorrect] = useState(0);
  const [wrongHint, setWrongHint] = useState(false);
  const [placedChipIds, setPlacedChipIds] = useState<(string | null)[]>([]);
  /** True as soon as all rounds pass locally (don't wait for persisted progress). */
  const [sessionComplete, setSessionComplete] = useState(false);

  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const fillDone = stepProgress.learn_fill;

  useEffect(() => {
    setRoundKey(0);
    setRoundsCorrect(0);
    setWrongHint(false);
    setSessionComplete(false);
    setPlacedChipIds([]);
  }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => setSutra(data));
  }, [id]);

  const exercise = useMemo(() => {
    if (!sutra?.lines?.length) return null;
    return buildFillExercise(sutra.lines);
  }, [sutra, roundKey]);

  useEffect(() => {
    if (exercise) {
      setPlacedChipIds(exercise.blanks.map(() => null));
      setWrongHint(false);
    }
  }, [exercise]);

  if (!sutra) {
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!stepProgress.learn && !stepProgress.learn_fill) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={styles.gateTitle}>Level 1 first</Text>
        <Text style={styles.gateBody}>Complete the sequence (drag-and-order) exercise, then come back here.</Text>
        <TouchableOpacity style={styles.nextBtn} onPress={() => router.replace(`/learn/${String(id)}`)}>
          <Text style={styles.nextBtnText}>Open Level 1</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={styles.centered}>
        <Text>Could not build an exercise for this sutra.</Text>
        <TouchableOpacity style={styles.nextBtn} onPress={() => router.push(`/recite/${String(id)}`)}>
          <Text style={styles.nextBtnText}>Skip to Level 3 →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const usedIds = new Set(placedChipIds.filter(Boolean) as string[]);
  const availableChips = exercise.chips.filter(c => !usedIds.has(c.id));

  const placeChip = (chipId: string) => {
    setWrongHint(false);
    const slot = placedChipIds.findIndex(x => x === null);
    if (slot === -1) return;
    setPlacedChipIds(prev => {
      const next = [...prev];
      next[slot] = chipId;
      return next;
    });
    void Haptics.selectionAsync();
  };

  const clearBlank = (slotIndex: number) => {
    setWrongHint(false);
    setPlacedChipIds(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  const isComplete = placedChipIds.every(Boolean);

  const checkAnswer = useCallback(() => {
    if (!sutra || !exercise) return;
    const ok =
      placedChipIds.every(Boolean) &&
      exercise.blanks.every((b, i) => {
        const cid = placedChipIds[i];
        if (!cid) return false;
        const chip = exercise.chips.find(c => c.id === cid);
        return chip && normWord(chip.word) === normWord(b.answer);
      });

    if (!ok) {
      setWrongHint(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWrongHint(false);
    setRoundsCorrect(prev => {
      const nextRound = prev + 1;
      if (nextRound >= ROUNDS_REQUIRED) {
        markStep(sutra.id, 'learn_fill');
        setSessionComplete(true);
      } else {
        setRoundKey(k => k + 1);
      }
      return nextRound;
    });
  }, [exercise, placedChipIds, markStep, sutra]);

  /** Only true after every round passes this visit — never infer from saved `learn_fill` alone (that caused empty puzzles + success banner). */
  const practiceComplete = sessionComplete || roundsCorrect >= ROUNDS_REQUIRED;
  /** Allow advancing if done now or already marked Level 2 in progress storage. */
  const canGoToLevel3 = practiceComplete || fillDone;
  const roundDisplay = practiceComplete ? ROUNDS_REQUIRED : roundsCorrect + 1;

  const blankSlotForWordIndex = (wordIndex: number) =>
    exercise.blanks.findIndex(b => b.wordIndex === wordIndex);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom + 16) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.step}>Level 2 of 3 · Fill in the blanks</Text>
        <Text style={styles.title}>Restore the line</Text>
        <Text style={styles.subtitle}>{sutra.title}</Text>
        <Text style={styles.meta}>
          Round {roundDisplay} of {ROUNDS_REQUIRED}
        </Text>

        {practiceComplete && (
          <View style={styles.successBanner} accessibilityRole="alert">
            <Text style={styles.successEmoji}>✓</Text>
            <View style={styles.successTextCol}>
              <Text style={styles.successTitle}>Level 2 complete</Text>
              <Text style={styles.successSubtitle}>
                {`Great job — continue when you're ready for the meaning quiz.`}
              </Text>
            </View>
          </View>
        )}

        {roundsCorrect === 0 && (
          <Text style={styles.translationHint}>{exercise.line.translation_en}</Text>
        )}
        {roundsCorrect > 0 && !practiceComplete && (
          <Text style={styles.translationHintMuted}>
            English hint hidden — recall the line from earlier rounds.
          </Text>
        )}

        <View style={styles.lineWrap}>
          <Text style={styles.lineLabel}>Transliteration</Text>
          <View style={styles.wordsRow}>
            {exercise.words.map((w, wi) => {
              const si = blankSlotForWordIndex(wi);
              if (si === -1) {
                return (
                  <Text key={wi} style={styles.wordShown}>
                    {w}{' '}
                  </Text>
                );
              }
              const cid = placedChipIds[si];
              const label = cid ? exercise.chips.find(c => c.id === cid)?.word ?? '?' : '———';
              return (
                <TouchableOpacity
                  key={wi}
                  style={[styles.blankChip, cid && styles.blankChipFilled]}
                  onPress={() => clearBlank(si)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.blankChipText, !cid && styles.blankChipPlaceholder]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={styles.bankLabel}>Tap a word to fill the next gap</Text>
        <View style={styles.bank}>
          {availableChips.map(chip => (
            <TouchableOpacity
              key={chip.id}
              style={styles.bankChip}
              onPress={() => placeChip(chip.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.bankChipText}>{chip.word}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {wrongHint && (
          <Text style={styles.wrongText}>Not quite — check each blank matches the original line.</Text>
        )}

        {!practiceComplete && (
          <TouchableOpacity
            style={[styles.checkBtn, !isComplete && styles.checkBtnDisabled]}
            disabled={!isComplete}
            onPress={() => checkAnswer()}
          >
            <Text style={styles.checkBtnText}>
              {isComplete ? 'Check answer' : 'Fill every blank to check'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(12, insets.bottom + 8) },
        ]}
      >
        {canGoToLevel3 && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => router.push(`/recite/${String(id)}`)}
          >
            <Text style={styles.nextBtnText}>Continue to Level 3 · Quiz →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  gateTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  gateBody: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#555' },
  step: {
    fontSize: 12,
    color: '#a0522d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 6 },
  meta: { fontSize: 12, color: '#aaa', marginBottom: 14 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  successEmoji: { fontSize: 28, lineHeight: 32 },
  successTextCol: { flex: 1 },
  successTitle: { fontSize: 17, fontWeight: '700', color: '#1b5e20', marginBottom: 4 },
  successSubtitle: { fontSize: 14, color: '#2e7d32', lineHeight: 20 },
  translationHint: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  translationHintMuted: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  lineWrap: {
    backgroundColor: '#fdf8f4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f0ebe3',
  },
  lineLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a0522d',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  wordShown: { fontSize: 16, fontStyle: 'italic', color: '#1a1a1a', lineHeight: 26 },
  blankChip: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d7cbbf',
    marginBottom: 4,
  },
  blankChipFilled: { borderColor: '#a0522d', backgroundColor: '#fffaf6' },
  blankChipText: { fontSize: 15, fontStyle: 'italic', fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  blankChipPlaceholder: { color: '#bbb', fontWeight: '500' },
  bankLabel: { fontSize: 13, color: '#666', marginBottom: 10 },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bankChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bankChipText: { fontSize: 14, fontStyle: 'italic', color: '#333', fontWeight: '600' },
  wrongText: { color: '#c62828', fontSize: 13, marginBottom: 12 },
  checkBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  checkBtnDisabled: { opacity: 0.45 },
  checkBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
  },
  nextBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
