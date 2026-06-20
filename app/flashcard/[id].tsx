import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { VoiceQuality } from 'expo-speech';
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
import { normalizeForGoogleTts, prepareTtsLineText } from '../../lib/google-cloud-tts';
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

let googleTtsEnabledCache: boolean | null = null;

/**
 * Uses Google Cloud audio from your backend when `/tts/google` is configured (recommended for Hindi/Devanagari).
 * Set EXPO_PUBLIC_USE_GOOGLE_TTS=false to force on-device expo-speech only.
 */
function shouldUseGoogleCloudTts(): boolean {
  const v = process.env.EXPO_PUBLIC_USE_GOOGLE_TTS?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return true;
}

function getDeviceTtsProsody(): { rate: number; pitch: number } {
  let rate = 0.82;
  const rEnv = process.env.EXPO_PUBLIC_TTS_RATE?.trim();
  if (rEnv) {
    const n = Number(rEnv);
    if (!Number.isNaN(n)) rate = Math.min(2, Math.max(0.1, n));
  }
  let pitch = 0.97;
  const pEnv = process.env.EXPO_PUBLIC_TTS_PITCH?.trim();
  if (pEnv) {
    const n = Number(pEnv);
    if (!Number.isNaN(n)) pitch = Math.min(2, Math.max(0.5, n));
  }
  return { rate, pitch };
}

function wordHighlightMsPerWord(): number {
  const { rate } = getDeviceTtsProsody();
  return Math.max(280, Math.round(420 * (0.72 / rate)));
}

function scoreVoiceForHindi(v: Speech.Voice): number {
  const id = `${v.identifier} ${v.name}`.toLowerCase();
  const lang = (v.language || '').toLowerCase();
  let s = 0;
  if (lang === 'hi-in') s += 220;
  else if (lang.startsWith('hi')) s += 200;
  else if (lang === 'mr-in') s += 45;
  else if (lang === 'ne-np' || lang === 'ne-in') s += 40;
  else if (lang.startsWith('en-in')) s += 18;

  if (v.quality === VoiceQuality.Enhanced) s += 120;

  if (
    /(neural|generative|gemini|premium|enhanced|refined|natural|wavenet|network|google|offline-high|studio)/.test(
      id,
    )
  ) {
    s += 48;
  }
  if (/(compact|tiny|pico|legacy)/.test(id) && !/enhanced|neural|premium/.test(id)) s -= 35;
  if (/standard/.test(id) && !/enhanced|neural|premium/.test(id)) s -= 10;

  return s;
}

async function getGoogleTtsEnabled(): Promise<boolean> {
  if (googleTtsEnabledCache !== null) return googleTtsEnabledCache;
  try {
    const r = await fetch(`${API_URL}/tts/google/status`);
    const j = await r.json().catch(() => ({}));
    googleTtsEnabledCache = !!(r.ok && j.enabled);
  } catch {
    googleTtsEnabledCache = false;
  }
  return googleTtsEnabledCache;
}

function normalizeTtsText(text: string) {
  // Tiny prosody hints for on-device TTS only.
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
    const sorted = [...voices].sort((a, b) => scoreVoiceForHindi(b) - scoreVoiceForHindi(a));
    const best = sorted[0];
    const bestScore = best ? scoreVoiceForHindi(best) : -1;
    if (best && bestScore > 0) {
      cachedVoicePick = { language: best.language || 'hi-IN', voice: best.identifier };
    } else {
      cachedVoicePick = { language: 'hi-IN' };
    }
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
  const googleSoundRef = useRef<Audio.Sound | null>(null);
  const googleWebUrlRef = useRef<string | null>(null);

  const stopGooglePlayback = async () => {
    if (googleSoundRef.current) {
      try {
        await googleSoundRef.current.stopAsync();
        await googleSoundRef.current.unloadAsync();
      } catch {
        /* ignore */
      }
      googleSoundRef.current = null;
    }
    if (googleWebUrlRef.current && Platform.OS === 'web') {
      URL.revokeObjectURL(googleWebUrlRef.current);
      googleWebUrlRef.current = null;
    }
  };

  const stopAllPlayback = async () => {
    await stopGooglePlayback();
    Speech.stop();
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setLoading(true);
    getBestHindiVoice().then(v => {
      voicePickRef.current = v;
    });
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
        setCurrentIndex(0);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setSutra(null);
        setLoading(false);
      });

    return () => {
      void stopAllPlayback();
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
    const msPerWord = wordHighlightMsPerWord();
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

  const runExpoSpeech = (line: Line, speakText: string, speechToken: number, onDone?: () => void) => {
    const voicePick = voicePickRef.current;
    const isWeb = Platform.OS === 'web';
    const { rate, pitch } = getDeviceTtsProsody();

    if (isWeb) {
      startWebWordHighlight(line.transliteration);
      Speech.speak(speakText, {
        language: voicePick.language || 'hi-IN',
        ...(voicePick.voice ? { voice: voicePick.voice } : {}),
        rate,
        pitch,
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
      const words = line.transliteration.split(' ');
      Speech.speak(speakText, {
        language: voicePick.language || 'hi-IN',
        ...(voicePick.voice ? { voice: voicePick.voice } : {}),
        rate,
        pitch,
        onBoundary: (e: any) => {
          if (speechToken !== speechTokenRef.current) return;
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

  const speakLine = (line: Line, onDone?: () => void) => {
    const speechToken = nextSpeechToken();
    void stopGooglePlayback();
    Speech.stop();
    clearWordTimers();
    setIsSpeaking(true);
    setHighlightedWordIndex(-1);
    const ttsText = prepareTtsLineText(line.transliteration, line.tts_devanagari);
    const googlePayloadText = normalizeForGoogleTts(ttsText);
    const speakTextDevice = normalizeTtsText(ttsText);

    void (async () => {
      let playedGoogle = false;
      if (shouldUseGoogleCloudTts() && (await getGoogleTtsEnabled())) {
        try {
          const res = await fetch(`${API_URL}/tts/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: googlePayloadText, mantra_style: true }),
          });
          if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);

          if (speechToken !== speechTokenRef.current) return;

          clearWordTimers();
          startWebWordHighlight(line.transliteration);

          let uri: string;
          if (Platform.OS === 'web') {
            const blob = await res.blob();
            uri = URL.createObjectURL(blob);
            googleWebUrlRef.current = uri;
          } else {
            const buf = await res.arrayBuffer();
            const outFile = new File(Paths.cache, `tts-${Date.now()}.mp3`);
            outFile.write(new Uint8Array(buf));
            uri = outFile.uri;
          }

          if (speechToken !== speechTokenRef.current) {
            if (Platform.OS === 'web' && googleWebUrlRef.current) {
              URL.revokeObjectURL(googleWebUrlRef.current);
              googleWebUrlRef.current = null;
            }
            return;
          }

          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true },
            status => {
              if (!status.isLoaded) {
                if (status.error) {
                  void sound.unloadAsync().catch(() => {});
                  googleSoundRef.current = null;
                  if (googleWebUrlRef.current && Platform.OS === 'web') {
                    URL.revokeObjectURL(googleWebUrlRef.current);
                    googleWebUrlRef.current = null;
                  }
                  if (speechToken !== speechTokenRef.current) return;
                  clearWordTimers();
                  setHighlightedWordIndex(-1);
                  setIsSpeaking(false);
                  onDone?.();
                }
                return;
              }
              if (status.didJustFinish) {
                void sound.unloadAsync().catch(() => {});
                googleSoundRef.current = null;
                if (googleWebUrlRef.current && Platform.OS === 'web') {
                  URL.revokeObjectURL(googleWebUrlRef.current);
                  googleWebUrlRef.current = null;
                }
                if (speechToken !== speechTokenRef.current) return;
                clearWordTimers();
                setHighlightedWordIndex(-1);
                setIsSpeaking(false);
                onDone?.();
              }
            },
          );
          googleSoundRef.current = sound;
          playedGoogle = true;
        } catch (e) {
          console.warn('Google TTS failed, using device speech', e);
        }
      }

      if (playedGoogle) return;
      if (speechToken !== speechTokenRef.current) return;
      runExpoSpeech(line, speakTextDevice, speechToken, onDone);
    })();
  };

  const goToPrev = () => {
    if (currentIndex === 0) return;
    nextSpeechToken();
    void stopAllPlayback();
    clearWordTimers();
    setIsSpeaking(false);
    setHighlightedWordIndex(-1);
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    animateTransition(() => setCurrentIndex(prev => prev - 1));
  };

  const goToNext = () => {
    if (!sutra || currentIndex >= sutra.lines.length - 1) return;
    nextSpeechToken();
    void stopAllPlayback();
    clearWordTimers();
    setIsSpeaking(false);
    setHighlightedWordIndex(-1);
    animateTransition(() => setCurrentIndex(prev => prev + 1));
  };

  useEffect(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (!isPlaying || !sutra?.lines?.length) return;

    const line = sutra.lines[Math.min(currentIndex, sutra.lines.length - 1)];
    if (!line) return;

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
      void stopAllPlayback();
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
    if (!sutra?.lines?.length) return;
    const line = sutra.lines[Math.min(currentIndex, sutra.lines.length - 1)];
    if (line) speakLine(line);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  if (!sutra || !Array.isArray(sutra.lines) || sutra.lines.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>Sutra not found</Text>
      </View>
    );
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), sutra.lines.length - 1);
  const currentLine = sutra.lines[safeIndex];
  if (!currentLine) {
    return (
      <View style={styles.centered}>
        <Text>Sutra not found</Text>
      </View>
    );
  }

  const progress = (safeIndex + 1) / sutra.lines.length;
  const isLast = safeIndex === sutra.lines.length - 1;
  const words = currentLine.transliteration.split(' ');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { void stopAllPlayback(); clearWordTimers(); router.back(); }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{sutra.title}</Text>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <Text style={styles.progressLabel}>{safeIndex + 1} of {sutra.lines.length}</Text>

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
            {isSpeaking ? '🔊 Speaking...' : '🔊 Read aloud'}
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
              router.push(`/recite/${id}` as any);
            }}
          >
            <Text style={styles.continueBtnText}>Continue to Level 1 · Quiz →</Text>
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