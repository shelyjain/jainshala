import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let speechRecognitionPkg: any = null;
try {
  speechRecognitionPkg = require('expo-speech-recognition');
} catch {
  speechRecognitionPkg = null;
}

const ExpoSpeechRecognitionModule = speechRecognitionPkg?.ExpoSpeechRecognitionModule;
const useSpeechRecognitionEventSafe: (eventName: string, callback: (event: any) => void) => void =
  speechRecognitionPkg?.useSpeechRecognitionEvent ?? (() => {});

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

type WordResult = {
  word: string;
  status: 'correct' | 'incorrect' | 'pending';
  spoken: string;
};

type LineState = {
  revealed: boolean;
  passed: boolean;
  wordResults: WordResult[] | null;
  isListening: boolean;
  attempts: number;
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isWordMatch(expected: string, spoken: string): boolean {
  const e = normalise(expected);
  const s = normalise(spoken);
  if (!e || !s) return false;
  const maxDist = e.length > 5 ? 2 : 1;
  return levenshtein(e, s) <= maxDist;
}

function matchWords(expected: string, spokenTranscript: string): WordResult[] {
  const expectedWords = expected.trim().split(/\s+/);
  const spokenWords = spokenTranscript.trim().split(/\s+/).filter(Boolean);
  return expectedWords.map((word, i) => {
    const spokenWord = spokenWords[i] ?? '';
    const correct = isWordMatch(word, spokenWord);
    return {
      word,
      status: spokenWord === '' ? 'pending' : correct ? 'correct' : 'incorrect',
      spoken: spokenWord,
    } as WordResult;
  });
}

function allCorrect(results: WordResult[]): boolean {
  return results.length > 0 && results.every(r => r.status === 'correct');
}

export default function ReciteSutra() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [lineStates, setLineStates] = useState<LineState[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const isAlreadyRecited = stepProgress.recite;
  const sttAvailable = Boolean(ExpoSpeechRecognitionModule);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
        setLineStates(
          data.lines.map(() => ({
            revealed: false,
            passed: false,
            wordResults: null,
            isListening: false,
            attempts: 0,
          }))
        );
      });
    return () => {
      ExpoSpeechRecognitionModule?.abort?.();
    };
  }, [id]);

  // Pulse while listening
  useEffect(() => {
    const isListening = activeLineIndex !== null && lineStates[activeLineIndex]?.isListening;
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [activeLineIndex, lineStates]);

  useSpeechRecognitionEventSafe('result', (event) => {
    if (activeLineIndex === null || !sutra) return;
    const transcript = event.results?.[0]?.transcript ?? '';
    if (!transcript) return;

    const line = sutra.lines[activeLineIndex];
    const results = matchWords(line.transliteration, transcript);
    const passed = allCorrect(results);

    setLineStates(prev => {
      const updated = [...prev];
      updated[activeLineIndex] = {
        ...updated[activeLineIndex],
        wordResults: results,
        passed,
        revealed: passed,
        isListening: false,
        attempts: updated[activeLineIndex].attempts + 1,
      };
      // Check if all lines now passed
      if (passed && updated.every(s => s.passed)) {
        markStep(String(id), 'recite');
      }
      return updated;
    });

    if (passed) setActiveLineIndex(null);
  });

  useSpeechRecognitionEventSafe('end', () => {
    setActiveLineIndex(prev => {
      if (prev !== null) {
        setLineStates(ls => {
          const updated = [...ls];
          if (updated[prev]) updated[prev] = { ...updated[prev], isListening: false };
          return updated;
        });
      }
      return prev;
    });
  });

  useSpeechRecognitionEventSafe('error', (event) => {
    console.warn('STT error:', event.error);
    if (activeLineIndex !== null) {
      setLineStates(prev => {
        const updated = [...prev];
        updated[activeLineIndex] = { ...updated[activeLineIndex], isListening: false };
        return updated;
      });
    }
    setActiveLineIndex(null);
  });

  const startListening = async (lineIndex: number) => {
    if (!sttAvailable) {
      alert('Voice recitation is not available in Expo Go on this device. Use a development build to enable microphone recognition.');
      return;
    }
    if (activeLineIndex !== null) ExpoSpeechRecognitionModule.abort();

    const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted.granted) {
      alert('Microphone permission is required to recite.');
      return;
    }

    setActiveLineIndex(lineIndex);
    setLineStates(prev => {
      const updated = [...prev];
      updated[lineIndex] = { ...updated[lineIndex], isListening: true, wordResults: null };
      return updated;
    });

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: false,
      maxAlternatives: 1,
    });
  };

  const stopListening = (lineIndex: number) => {
    ExpoSpeechRecognitionModule?.stop?.();
    setLineStates(prev => {
      const updated = [...prev];
      updated[lineIndex] = { ...updated[lineIndex], isListening: false };
      return updated;
    });
    setActiveLineIndex(null);
  };

  const revealManually = (lineIndex: number) => {
    setLineStates(prev => {
      const updated = [...prev];
      updated[lineIndex] = { ...updated[lineIndex], revealed: true, passed: true };
      if (updated.every(s => s.passed)) markStep(String(id), 'recite');
      return updated;
    });
  };

  if (!sutra || lineStates.length === 0) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  const allPassed = lineStates.every(s => s.passed);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 24) }]}
      showsVerticalScrollIndicator
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Level 3 of 3 · Voice</Text>
      <Text style={styles.title}>Recite from memory</Text>
      <Text style={styles.subtitle}>{sutra.title}</Text>
      <Text style={styles.hint}>
        Tap the mic and say each line aloud. 🟢 Green = correct, 🔴 Red = try again.
      </Text>
      {!sttAvailable && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Voice recitation is unavailable in Expo Go for this module. You can still continue manually with "Reveal anyway", or run a development build to enable speech recognition.
          </Text>
        </View>
      )}

      {sutra.lines.map((line, i) => {
        const state = lineStates[i];
        const isActive = activeLineIndex === i;

        return (
          <View
            key={line.line_number}
            style={[styles.lineCard, state.passed && styles.lineCardPassed]}
          >
            {/* Header */}
            <View style={styles.lineCardHeader}>
              <View style={[styles.lineNumBadge, state.passed && styles.lineNumBadgePassed]}>
                <Text style={styles.lineNumText}>{line.line_number}</Text>
              </View>
              {state.passed && <Text style={styles.passedBadge}>✓ Recited</Text>}
              {!state.passed && state.attempts > 0 && (
                <Text style={styles.attemptsBadge}>
                  {state.attempts} attempt{state.attempts !== 1 ? 's' : ''}
                </Text>
              )}
            </View>

            {/* Word-by-word feedback */}
            {state.wordResults && !state.passed && (
              <View style={styles.wordResultsRow}>
                {state.wordResults.map((wr, wi) => (
                  <View key={wi} style={styles.wordResultItem}>
                    <Text
                      style={[
                        styles.wordResultText,
                        wr.status === 'correct' && styles.wordCorrect,
                        wr.status === 'incorrect' && styles.wordIncorrect,
                        wr.status === 'pending' && styles.wordPending,
                      ]}
                    >
                      {wr.status === 'incorrect' ? (wr.spoken || wr.word) : wr.word}
                    </Text>
                    {wr.status === 'incorrect' && (
                      <Text style={styles.wordExpected}>({wr.word})</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Revealed line */}
            {state.revealed && (
              <View style={styles.revealedContent}>
                <Text style={styles.lineTranslit}>{line.transliteration}</Text>
                <Text style={styles.lineTranslation}>{line.translation_en}</Text>
              </View>
            )}

            {/* Mic controls */}
            {!state.passed && (
              <View style={styles.micRow}>
                {isActive && state.isListening ? (
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                      style={[styles.micBtn, styles.micBtnActive]}
                      onPress={() => stopListening(i)}
                    >
                      <Text style={styles.micBtnText}>🎙️ Listening… tap to stop</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <TouchableOpacity
                    style={[styles.micBtn, !sttAvailable && styles.micBtnDisabled]}
                    onPress={() => startListening(i)}
                    disabled={!sttAvailable}
                  >
                    <Text style={styles.micBtnText}>
                      {!sttAvailable
                        ? '🎙️ Unavailable in Expo Go'
                        : state.attempts > 0
                          ? '🎙️ Try again'
                          : '🎙️ Tap to recite'}
                    </Text>
                  </TouchableOpacity>
                )}

                {state.attempts >= 3 && (
                  <TouchableOpacity style={styles.revealBtn} onPress={() => revealManually(i)}>
                    <Text style={styles.revealBtnText}>Reveal anyway</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {(allPassed || isAlreadyRecited) && (
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
  step: { fontSize: 12, color: '#a0522d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  hint: { fontSize: 13, color: '#a0522d', marginBottom: 20, lineHeight: 20, fontStyle: 'italic' },
  warningBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  warningText: { color: '#9a3412', fontSize: 12, lineHeight: 18 },

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
    marginBottom: 10,
    gap: 10,
  },
  lineNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#a0522d',
    alignItems: 'center', justifyContent: 'center',
  },
  lineNumBadgePassed: {
    backgroundColor: '#4caf50',
  },
  lineNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  passedBadge: { fontSize: 12, color: '#4caf50', fontWeight: '700' },
  attemptsBadge: { fontSize: 12, color: '#999' },

  wordResultsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0e0e0',
  },
  wordResultItem: { alignItems: 'center' },
  wordResultText: { fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
  wordCorrect: { color: '#2e7d32' },
  wordIncorrect: { color: '#c62828', textDecorationLine: 'underline' },
  wordPending: { color: '#bbb' },
  wordExpected: { fontSize: 10, color: '#aaa', marginTop: 2 },

  revealedContent: { marginBottom: 10 },
  lineTranslit: { fontSize: 15, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 4 },
  lineTranslation: { fontSize: 13, color: '#888' },

  micRow: { gap: 8 },
  micBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#a0522d',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  micBtnActive: { backgroundColor: '#fdf0e8' },
  micBtnDisabled: { opacity: 0.5 },
  micBtnText: { color: '#a0522d', fontSize: 14, fontWeight: '600' },
  revealBtn: { alignItems: 'center', paddingVertical: 8 },
  revealBtnText: { fontSize: 13, color: '#bbb', textDecorationLine: 'underline' },

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