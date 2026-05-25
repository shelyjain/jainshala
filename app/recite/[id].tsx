import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildMcqOptions } from '../../lib/mcq';
import * as Haptics from 'expo-haptics';

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

type LineQuizState = {
  options: string[];
  passed: boolean;
  selected: string | null;
  wrongPick: string | null;
};

export default function ReciteSutra() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [lineStates, setLineStates] = useState<LineQuizState[]>([]);
  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const isAlreadyDone = stepProgress.recite;

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then((data: Sutra) => {
        setSutra(data);
        const pool = data.lines.map(l => l.transliteration);
        setLineStates(
          data.lines.map(line => ({
            options: buildMcqOptions(
              line.transliteration,
              pool.filter(t => t !== line.transliteration)
            ),
            passed: false,
            selected: null,
            wrongPick: null,
          }))
        );
      });
  }, [id]);

  const handlePick = (lineIndex: number, option: string) => {
    if (!sutra || lineStates[lineIndex]?.passed) return;

    const correct = sutra.lines[lineIndex].transliteration;
    if (option === correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLineStates(prev => {
        const updated = [...prev];
        updated[lineIndex] = {
          ...updated[lineIndex],
          passed: true,
          selected: option,
          wrongPick: null,
        };
        if (updated.every(s => s.passed)) {
          markStep(String(id), 'recite');
        }
        return updated;
      });
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setLineStates(prev => {
      const updated = [...prev];
      updated[lineIndex] = {
        ...updated[lineIndex],
        selected: option,
        wrongPick: option,
      };
      return updated;
    });
  };

  const retryLine = (lineIndex: number) => {
    setLineStates(prev => {
      const updated = [...prev];
      updated[lineIndex] = {
        ...updated[lineIndex],
        selected: null,
        wrongPick: null,
      };
      return updated;
    });
  };

  if (!sutra || lineStates.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const allPassed = lineStates.every(s => s.passed);
  const passedCount = lineStates.filter(s => s.passed).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(24, insets.bottom + 24) },
      ]}
      showsVerticalScrollIndicator
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Level 3 of 3 · Quiz</Text>
      <Text style={styles.title}>Match the meaning</Text>
      <Text style={styles.subtitle}>{sutra.title}</Text>
      <Text style={styles.hint}>
        Read each English meaning and choose the correct transliterated line. {passedCount}/
        {sutra.lines.length} correct.
      </Text>

      {sutra.lines.map((line, i) => {
        const state = lineStates[i];

        return (
          <View
            key={line.line_number}
            style={[styles.lineCard, state.passed && styles.lineCardPassed]}
          >
            <View style={styles.lineCardHeader}>
              <View style={[styles.lineNumBadge, state.passed && styles.lineNumBadgePassed]}>
                <Text style={styles.lineNumText}>{line.line_number}</Text>
              </View>
              {state.passed ? (
                <Text style={styles.passedBadge}>✓ Correct</Text>
              ) : state.wrongPick ? (
                <Text style={styles.wrongBadge}>Try again</Text>
              ) : null}
            </View>

            <Text style={styles.questionLabel}>What is the sutra line for this meaning?</Text>
            <Text style={styles.questionText}>{line.translation_en}</Text>

            {state.passed ? (
              <View style={styles.answerReveal}>
                <Text style={styles.answerRevealText}>{line.transliteration}</Text>
              </View>
            ) : (
              <View style={styles.optionsGrid}>
                {state.options.map(option => {
                  const isSelected = state.selected === option;
                  const isWrong = state.wrongPick === option;
                  const isCorrectOption = option === line.transliteration;

                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionBtn,
                        isWrong && styles.optionBtnWrong,
                        isSelected && isCorrectOption && styles.optionBtnCorrect,
                      ]}
                      onPress={() => handlePick(i, option)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isWrong && styles.optionTextWrong,
                        ]}
                        numberOfLines={3}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {state.wrongPick && !state.passed ? (
              <TouchableOpacity style={styles.retryBtn} onPress={() => retryLine(i)}>
                <Text style={styles.retryBtnText}>Clear and try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {(allPassed || isAlreadyDone) && (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => router.push(`/complete/${String(id)}`)}
        >
          <Text style={styles.completeBtnText}>Complete Sutra 🏅</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, paddingTop: 60 },
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
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  hint: { fontSize: 13, color: '#a0522d', marginBottom: 20, lineHeight: 20, fontStyle: 'italic' },

  lineCard: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lineCardPassed: {
    backgroundColor: '#f4faf4',
    borderColor: '#4caf50',
  },
  lineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  lineNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#a0522d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineNumBadgePassed: { backgroundColor: '#4caf50' },
  lineNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  passedBadge: { fontSize: 12, color: '#4caf50', fontWeight: '700' },
  wrongBadge: { fontSize: 12, color: '#c62828', fontWeight: '700' },

  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
    marginBottom: 14,
    fontWeight: '600',
  },

  optionsGrid: { gap: 10 },
  optionBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d8d0c8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionBtnWrong: {
    borderColor: '#ef9a9a',
    backgroundColor: '#ffebee',
  },
  optionBtnCorrect: {
    borderColor: '#81c784',
    backgroundColor: '#e8f5e9',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 20,
    textAlign: 'center',
  },
  optionTextWrong: { color: '#c62828' },

  answerReveal: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  answerRevealText: {
    fontSize: 15,
    color: '#2e7d32',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },

  retryBtn: { alignItems: 'center', marginTop: 10, paddingVertical: 6 },
  retryBtnText: { fontSize: 13, color: '#a0522d', fontWeight: '600' },

  completeBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
