import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useProgress } from '../../../hooks/use-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildMcqOptions } from '../../../lib/mcq';
import * as Haptics from 'expo-haptics';

type SongLine = {
  timestamp_ms: number;
  gujarati: string;
  transliteration: string;
  translation_en: string;
};

type Song = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  lines: SongLine[];
};

type LineQuizState = {
  options: string[];
  passed: boolean;
  selected: string | null;
  wrongPick: string | null;
};

const DEFAULT_SONGS = {
  aarti: {
    id: 'aarti',
    title: 'Shree Adinath Aarti',
    artist: 'Traditional',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lines: [
      { timestamp_ms: 0, gujarati: 'જય જય આરતી આદિ જિણંદા, નાભિરાયા મરૂદેવીકા નંદા.', transliteration: 'Jaya Jaya Aarti Aadi Jinanda, Naabhiraya Maroodevika Nanda. Jaya Jaya Aarti Aadi Jinanda.', translation_en: 'Victory, victory to the first Jina, Lord Adinath, the beloved son of King Nabhi and Queen Marudevi.' },
      { timestamp_ms: 6000, gujarati: 'પહેલી આરતી પૂજા કીજે, નર ભવ પામી ને લહાવો લીજે.', transliteration: 'Pehli Aarti Puja Kije, Nar Bhav Paami Ne Lahavo Leeje.', translation_en: 'Perform the first aarti and worship the Lord; having attained this rare human life, earn the spiritual profit.' },
      { timestamp_ms: 12000, gujarati: 'દુસરી આરતી દિન દયાલા, ધુલેવા મંડપ મા જગ અજવાલા.', transliteration: 'Dusri Aarti Din Dayala, Dhuleva Mandap Ma Jag Ajwala.', translation_en: 'The second aarti is to the merciful Lord of the humble, whose presence illuminates the great temple at Dhuleva.' },
      { timestamp_ms: 18000, gujarati: 'તીસરી આરતી ત્રિભુવન દેવા, સુર નર ઇન્દ્ર કરે તોરી સેવા.', transliteration: 'Teesri Aarti Tribhuvan Deva, Sur Nar Indra Kare Tori Seva.', translation_en: 'The third aarti is to the Lord of the three worlds, whom gods, humans, and Indras serve with devotion.' },
      { timestamp_ms: 24000, gujarati: 'ચોથી આરતી ચૌગતિ ચુરે, મન વાંછિત ફલ શિવ સુખ પુરે.', transliteration: 'Chauthi Aarti Chaugati Chure, Mann Vanchhiit Fal Shiv Sukh Pure.', translation_en: 'The fourth aarti destroys the cycle of the four destinies, fulfilling all pure desires and granting the bliss of liberation.' },
      { timestamp_ms: 30000, gujarati: 'પંચમી આરતી પુણ્ય ઉપાયો, મૂલચંદે ઋષભ ગુણ ગાયો.', transliteration: 'Panchmi Aarti Punya Upaayo, Mulchande Rushabh Gun Gaayo. Jaya Jaya Aarti Aadi Jinanda.', translation_en: 'Through the fifth aarti, spiritual merit is earned. The devotee Mulchand sings the glorious virtues of Lord Rishabhdev.' },
      { timestamp_ms: 36000, gujarati: 'નાભિરાયા મરૂદેવીકા નંદા.', transliteration: 'Naabhiraya Maroodevika Nanda.', translation_en: 'The beloved son of King Nabhi and Queen Marudevi.' }
    ]
  },
  'mangal-deevo': {
    id: 'mangal-deevo',
    title: 'Mangal Deevo',
    artist: 'Kumarpal',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    lines: [
      { timestamp_ms: 0, gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારી ને બહુ ચિરંજીવો.', transliteration: 'Deevo re deevo prabhu mangalika deevo, Aarati utari ne bahu chiranjeevo.', translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.' },
      { timestamp_ms: 7000, gujarati: 'સોહામણું ઘર પર્વ દિવાલી, અંબર ખેલે અમરા બાલી.', transliteration: 'Sohamanu ghar parva dewali, Ambar khele amra bali.', translation_en: 'The festival is as beautiful as Diwali in our homes, and the young gods in heaven celebrate with joy.' },
      { timestamp_ms: 14000, gujarati: 'દીપાલ ભણે અને એ કલિ કાલે, આરતી ઉતારી રાજા કુમારપાલે.', transliteration: 'Depal bhane ane ae kali kale, Arati utari raja kumarpale.', translation_en: 'The poet Depal sings that in this dark age of Kali-yuga, King Kumarpal performed this auspicious aarti.' },
      { timestamp_ms: 21000, gujarati: 'અમા ઘર મંગલીક, તુમ ઘર મંગલીક, મંગલીક ચતુર્વિધ સંઘ ને હોજો.', transliteration: 'Ama ghar mangalika, tum ghar mangalika, Mangalika chaturvidha sangh ne hojo.', translation_en: 'May there be auspiciousness in our homes, in your homes, and may there be auspiciousness for the entire four-fold Jain community.' },
      { timestamp_ms: 28000, gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારણા બહુ ચિરંજીવો.', transliteration: 'Divo re divo prabhu magalic divo, Arati utarana bahu chiranjivo.', translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.' }
    ]
  }
};

export default function SongQuizScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineStates, setLineStates] = useState<LineQuizState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const isAlreadyDone = stepProgress.recite;

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const snap = await getDoc(doc(db, 'songs', String(id)));
        let data: Song | null = null;
        if (snap.exists()) {
          data = { id: snap.id, ...snap.data() } as Song;
        } else {
          data = DEFAULT_SONGS[id as keyof typeof DEFAULT_SONGS] || null;
        }

        if (data) {
          setSong(data);
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
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void fetchSong();
  }, [id]);

  const handlePick = (lineIndex: number, option: string) => {
    if (!song || lineStates[lineIndex]?.passed) return;

    const correct = song.lines[lineIndex].transliteration;
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

  const goToNextQuestion = () => {
    if (!song) return;
    setCurrentIndex(prev => Math.min(prev + 1, song.lines.length - 1));
  };

  const handleFinish = () => {
    router.replace(`/song/${id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a0522d" />
        </View>
      </SafeAreaView>
    );
  }

  if (!song || lineStates.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.missWrap}>
          <Text style={styles.missText}>Song quiz could not be loaded.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allPassed = lineStates.every(s => s.passed);
  const passedCount = lineStates.filter(s => s.passed).length;
  const line = song.lines[currentIndex];
  const state = lineStates[currentIndex];
  const isLastQuestion = currentIndex === song.lines.length - 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Coordinator</Text>
        </TouchableOpacity>

        <Text style={styles.stepHeader}>Level 3 of 3 · Quiz</Text>
        <Text style={styles.title}>Match the meaning</Text>
        <Text style={styles.subtitle}>{song.title}</Text>
        <Text style={styles.hint}>
          Read the English translation and choose the correct transliterated song line. {passedCount}/
          {song.lines.length} correct.
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            Question {currentIndex + 1} of {song.lines.length}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentIndex + (state.passed ? 1 : 0)) / song.lines.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {song.lines.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                lineStates[i].passed && styles.dotPassed,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Quiz Card */}
        <View style={[styles.lineCard, state.passed && styles.lineCardPassed]}>
          <View style={styles.lineCardHeader}>
            <View style={[styles.lineNumBadge, state.passed && styles.lineNumBadgePassed]}>
              <Text style={styles.lineNumText}>{currentIndex + 1}</Text>
            </View>
            {state.passed ? (
              <Text style={styles.passedBadge}>✓ Correct</Text>
            ) : state.wrongPick ? (
              <Text style={styles.wrongBadge}>Try again</Text>
            ) : null}
          </View>

          <Text style={styles.questionLabel}>What is the song line for this meaning?</Text>
          <Text style={styles.questionText}>{line.translation_en}</Text>

          {state.passed ? (
            <View style={styles.answerReveal}>
              {line.gujarati ? <Text style={styles.gujaratiText}>{line.gujarati}</Text> : null}
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
                    onPress={() => handlePick(currentIndex, option)}
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
            <TouchableOpacity style={styles.retryBtn} onPress={() => retryLine(currentIndex)}>
              <Text style={styles.retryBtnText}>Clear and try again</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {state.passed && !isLastQuestion ? (
          <TouchableOpacity style={styles.nextBtn} onPress={goToNextQuestion}>
            <Text style={styles.nextBtnText}>Next question →</Text>
          </TouchableOpacity>
        ) : null}

        {(allPassed || isAlreadyDone) && (
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
            <Text style={styles.finishBtnText}>Stage Complete ✓</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf8f5' },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  missWrap: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  missText: { fontSize: 16, color: '#333' },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: 14, color: '#a0522d', fontWeight: '700' },

  stepHeader: { fontSize: 11, fontWeight: '800', color: '#a0522d', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2, fontWeight: '600' },
  hint: { fontSize: 13, color: '#888', marginTop: 8, lineHeight: 18 },

  progressRow: { marginTop: 20 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: '#ebe6e0', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#a0522d', borderRadius: 3 },

  dotsRow: { flexDirection: 'row', gap: 6, marginVertical: 16, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2d8cd' },
  dotActive: { backgroundColor: '#a0522d', transform: [{ scale: 1.25 }] },
  dotPassed: { backgroundColor: '#a5d6a7' },

  lineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 20,
  },
  lineCardPassed: { borderColor: '#a5d6a7', borderWidth: 1.5, backgroundColor: '#f9fdfa' },
  lineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  lineNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5ebe3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineNumBadgePassed: { backgroundColor: '#e8f5e9' },
  lineNumText: { fontSize: 13, fontWeight: '800', color: '#a0522d' },
  passedBadge: { color: '#2e7d32', fontSize: 13, fontWeight: '700' },
  wrongBadge: { color: '#cc3333', fontSize: 13, fontWeight: '700' },

  questionLabel: { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 0.8, textTransform: 'uppercase' },
  questionText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 6, lineHeight: 22 },

  answerReveal: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    gap: 6,
  },
  gujaratiText: { fontSize: 17, color: '#2e7d32', fontWeight: '600' },
  answerRevealText: { fontSize: 15, fontWeight: '700', color: '#1b5e20', lineHeight: 20 },

  optionsGrid: { gap: 10, marginTop: 18 },
  optionBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ede7df',
    borderRadius: 12,
    padding: 14,
  },
  optionBtnCorrect: { borderColor: '#a5d6a7', backgroundColor: '#e8f5e9', borderWidth: 1.5 },
  optionBtnWrong: { borderColor: '#ffcdd2', backgroundColor: '#ffebee', borderWidth: 1.5 },
  optionText: { fontSize: 14, fontWeight: '700', color: '#333', lineHeight: 18 },
  optionTextWrong: { color: '#cc3333' },

  retryBtn: { marginTop: 14, alignSelf: 'center', padding: 8 },
  retryBtnText: { color: '#a0522d', fontSize: 13, fontWeight: '700' },

  nextBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  finishBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2e7d32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  finishBtnText: { color: '#2e7d32', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#f5ebe3', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  secondaryBtnText: { color: '#a0522d', fontSize: 15, fontWeight: '700' },
});
