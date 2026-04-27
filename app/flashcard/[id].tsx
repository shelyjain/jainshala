import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';

type Line = {
  line_number: number;
  transliteration: string;
  translation_en: string;
  tts_devanagari?: string;
};

type Sutra = {
  id: string;
  title: string;
  lines: Line[];
};

type VoicePick = {
  language: string;
  voice?: string;
};

let cachedVoicePick: VoicePick | null = null;

function normalizeTtsText(text: string) {
  // Tiny prosody hints for mantra cadence.
  return text
    .replace(/\s+/g, ' ')
    .replace(/[,;:]/g, ' , ')
    .replace(/\./g, ' . ')
    .trim();
}

async function getBestHindiVoice(): Promise<VoicePick> {
  if (cachedVoicePick) return cachedVoicePick;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const preferred = process.env.EXPO_PUBLIC_TTS_VOICE?.trim();
    if (preferred) {
      const exact = voices.find(v => v.identifier === preferred || v.name === preferred);
      if (exact) {
        cachedVoicePick = { language: exact.language || 'hi-IN', voice: exact.identifier };
        return cachedVoicePick;
      }
    }
    const sorted = [...voices].sort((a, b) => {
      const ah = `${a.name} ${a.identifier}`.toLowerCase();
      const bh = `${b.name} ${b.identifier}`.toLowerCase();
      const aHi = a.language?.toLowerCase().startsWith('hi') ? 100 : 0;
      const bHi = b.language?.toLowerCase().startsWith('hi') ? 100 : 0;
      const aNeural = /(neural|natural|wavenet|network|enhanced)/.test(ah) ? 10 : 0;
      const bNeural = /(neural|natural|wavenet|network|enhanced)/.test(bh) ? 10 : 0;
      return bHi + bNeural - (aHi + aNeural);
    });
    const best = sorted[0];
    cachedVoicePick = best
      ? { language: best.language || 'hi-IN', voice: best.identifier }
      : { language: 'hi-IN' };
    return cachedVoicePick;
  } catch {
    cachedVoicePick = { language: 'hi-IN' };
    return cachedVoicePick;
  }
}

export default function FlashcardScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { markStep } = useProgress();

  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speechTokenRef = useRef(0);
  const voicePickRef = useRef<VoicePick>({ language: 'hi-IN' });

  useEffect(() => {
    getBestHindiVoice().then(v => {
      voicePickRef.current = v;
    });
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    return () => {
      Speech.stop();
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
      clearWordTimers();
    };
  }, [id]);

  const clearWordTimers = () => {
    wordTimerRefs.current.forEach(t => clearTimeout(t));
    wordTimerRefs.current = [];
  };

  const nextSpeechToken = () => {
    speechTokenRef.current += 1;
    return speechTokenRef.current;
  };

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const startWebWordHighlight = (text: string) => {
    const words = text.split(' ');
    // Estimate ~400ms per word at rate 0.85
    const msPerWord = 420;
    clearWordTimers();
    setHighlightedWordIndex(0);

    words.forEach((_, i) => {
      const t = setTimeout(() => {
        setHighlightedWordIndex(i);
      }, i * msPerWord);
      wordTimerRefs.current.push(t);
    });

    const doneTimer = setTimeout(() => {
      setHighlightedWordIndex(-1);
    }, words.length * msPerWord + 300);
    wordTimerRefs.current.push(doneTimer);
  };

  const speakLine = (line: Line, onDone?: () => void) => {
    const speechToken = nextSpeechToken();
    Speech.stop();
    clearWordTimers();
    setIsSpeaking(true);
    setHighlightedWordIndex(-1);
    const speakText = normalizeTtsText(line.tts_devanagari?.trim() || line.transliteration);
    const voicePick = voicePickRef.current;

    const isWeb = Platform.OS === 'web';

    if (isWeb) {
      // Web: start timer-based highlighting immediately, then speak
      startWebWordHighlight(line.transliteration);
      Speech.speak(speakText, {
        language: voicePick.language || 'hi-IN',
        ...(voicePick.voice ? { voice: voicePick.voice } : {}),
        rate: 0.72,
        pitch: 0.92,
        onDone: () => {
          if (speechToken !== speechTokenRef.current) return;
          setHighlightedWordIndex(-1);
          setIsSpeaking(false);
          onDone?.();
        },
        onError: () => {
          if (speechToken !== speechTokenRef.current) return;
          clearWordTimers();
          setHighlightedWordIndex(-1);
          setIsSpeaking(false);
          onDone?.();
        },
      });
    } else {
      // iOS: use onBoundary for accurate word highlighting
      const words = line.transliteration.split(' ');
      Speech.speak(speakText, {
        language: voicePick.language || 'hi-IN',
        ...(voicePick.voice ? { voice: voicePick.voice } : {}),
        rate: 0.72,
        pitch: 0.92,
        onBoundary: (e: any) => {
          if (speechToken !== speechTokenRef.current) return;
          // e.charIndex is the char position of the word being spoken
          const charIndex = e?.charIndex ?? 0;
          let wordIdx = 0;
          let charCount = 0;
          for (let i = 0; i < words.length; i++) {
            if (charCount >= charIndex) {
              wordIdx = i;
              break;
            }
            charCount += words[i].length + 1;
            wordIdx = i + 1;
          }
          setHighlightedWordIndex(Math.min(wordIdx, words.length - 1));
        },
        onDone: () => {
          if (speechToken !== speechTokenRef.current) return;
          setHighlightedWordIndex(-1);
          setIsSpeaking(false);
          onDone?.();
        },
        onError: () => {
          if (speechToken !== speechTokenRef.current) return;
          setHighlightedWordIndex(-1);
          setIsSpeaking(false);
          onDone?.();
        },
      });
    }
  };

  const goToPrev = () => {
    if (currentIndex === 0) return;
    nextSpeechToken();
    Speech.stop();
    clearWordTimers();
    setIsSpeaking(false);
    setHighlightedWordIndex(-1);
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    animateTransition(() => setCurrentIndex(prev => prev - 1));
  };

  const goToNext = () => {
    if (!sutra || currentIndex >= sutra.lines.length - 1) return;
    nextSpeechToken();
    Speech.stop();
    clearWordTimers();
    setIsSpeaking(false);
    setHighlightedWordIndex(-1);
    animateTransition(() => setCurrentIndex(prev => prev + 1));
  };

  useEffect(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (!isPlaying || !sutra) return;

    const line = sutra.lines[currentIndex];
    speakLine(line, () => {
      autoPlayRef.current = setTimeout(() => {
        setCurrentIndex(prev => {
          if (prev < sutra.lines.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1000);
    });

    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [isPlaying, currentIndex, sutra]);

  const togglePlay = () => {
    if (isPlaying) {
      nextSpeechToken();
      Speech.stop();
      clearWordTimers();
      setIsSpeaking(false);
      setHighlightedWordIndex(-1);
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const handleSpeakNow = () => {
    if (!sutra) return;
    speakLine(sutra.lines[currentIndex]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  if (!sutra) {
    return (
      <View style={styles.centered}>
        <Text>Sutra not found</Text>
      </View>
    );
  }

  const currentLine = sutra.lines[currentIndex];
  const progress = (currentIndex + 1) / sutra.lines.length;
  const isLast = currentIndex === sutra.lines.length - 1;
  const words = currentLine.transliteration.split(' ');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Speech.stop(); clearWordTimers(); router.back(); }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{sutra.title}</Text>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <Text style={styles.progressLabel}>{currentIndex + 1} of {sutra.lines.length}</Text>

      <Animated.View
        style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.lineNumberBadge}>
          <Text style={styles.lineNumberText}>{currentLine.line_number}</Text>
        </View>

        {/* Word-by-word highlighted transliteration */}
        <View style={styles.wordsRow}>
          {words.map((word, i) => (
            <Text
              key={i}
              style={[
                styles.word,
                highlightedWordIndex === i && styles.wordHighlighted,
              ]}
            >
              {word}{i < words.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.translation}>{currentLine.translation_en}</Text>

        <TouchableOpacity
          style={[styles.speakBtn, isSpeaking && styles.speakBtnActive]}
          onPress={handleSpeakNow}
          disabled={isSpeaking}
        >
          <Text style={styles.speakBtnText}>
            {isSpeaking ? '🔊 Speaking...' : '🔊 Read aloud in Hindi'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={goToPrev}
          disabled={currentIndex === 0}
        >
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>← Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
          onPress={togglePlay}
        >
          <Text style={styles.playBtnText}>{isPlaying ? '⏸ Pause' : '▶ Auto-play'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, isLast && styles.navBtnDisabled]}
          onPress={goToNext}
          disabled={isLast}
        >
          <Text style={[styles.navBtnText, isLast && styles.navBtnTextDisabled]}>Next →</Text>
        </TouchableOpacity>
      </View>

      {isLast && !isPlaying && (
        <View style={styles.doneRow}>
          <Text style={styles.doneText}>🏁 You've finished listening!</Text>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              markStep(String(id), 'listen');
              router.push(`/learn/${id}` as any);
            }}
          >
            <Text style={styles.continueBtnText}>Continue to Learn →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            setHighlightedWordIndex(-1);
            animateTransition(() => setCurrentIndex(0));
          }}>
            <Text style={styles.restartText}>↺ Restart flashcards</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backText: { fontSize: 16, color: '#555' },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#a0522d', textAlign: 'right' },
  progressBarTrack: { height: 4, backgroundColor: '#f0ebe3', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: 4, backgroundColor: '#a0522d', borderRadius: 2 },
  progressLabel: { fontSize: 12, color: '#999', textAlign: 'right', marginBottom: 24 },
  card: {
    flex: 1,
    backgroundColor: '#fdf8f4',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#f0ebe3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#a0522d',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lineNumberBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#a0522d',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  lineNumberText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 4,
  },
  word: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    fontStyle: 'italic',
    lineHeight: 36,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 6,
  },
  wordHighlighted: {
    color: '#a0522d',
    backgroundColor: '#fde8d8',
    borderRadius: 6,
  },
  divider: { width: 40, height: 2, backgroundColor: '#f0ebe3', borderRadius: 1, marginBottom: 20 },
  translation: { fontSize: 17, color: '#555', textAlign: 'center', lineHeight: 26, marginBottom: 28 },
  speakBtn: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#a0522d',
    borderRadius: 24, paddingVertical: 10, paddingHorizontal: 20,
  },
  speakBtnActive: { backgroundColor: '#fdf0e8' },
  speakBtnText: { color: '#a0522d', fontSize: 14, fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  navBtn: {
    paddingVertical: 12, paddingHorizontal: 18,
    backgroundColor: '#faf6f2', borderRadius: 12, borderWidth: 1, borderColor: '#f0ebe3',
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: '#a0522d' },
  navBtnTextDisabled: { color: '#bbb' },
  playBtn: { flex: 1, paddingVertical: 14, backgroundColor: '#a0522d', borderRadius: 12, alignItems: 'center' },
  playBtnActive: { backgroundColor: '#7a3e20' },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  doneRow: { alignItems: 'center', marginBottom: 32, gap: 6 },
  doneText: { fontSize: 14, color: '#888' },
  restartText: { fontSize: 14, color: '#a0522d', fontWeight: '600', textDecorationLine: 'underline' },
  continueBtn: { backgroundColor: '#a0522d', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});