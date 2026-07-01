import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProgress } from '../../hooks/use-progress';

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

const STEPS = [
  { key: 'listen' as const, label: 'Listen & Follow', icon: '🎧', doneIcon: '✓' },
  { key: 'learn_fill' as const, label: 'Fill-in-the-Blanks', icon: '✏️', doneIcon: '✓' },
  { key: 'recite' as const, label: 'Quiz', icon: '❓', doneIcon: '✓' },
];

export default function SongDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const { isCompleted, markStep, getStepProgress } = useProgress();

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const snap = await getDoc(doc(db, 'songs', String(id)));
        if (snap.exists()) {
          setSong({ id: snap.id, ...snap.data() } as Song);
        } else {
          // If Firestore is empty, try to match from DEFAULT_SONGS
          // This ensures fallback works fine during seeding
          const fallbackSongs = [
            {
              id: 'aarti',
              title: 'Shree Adinath Aarti',
              artist: 'Traditional',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              lines: [
                {
                  timestamp_ms: 0,
                  gujarati: 'જય જય આરતી આદિ જિણંદા, નાભિરાયા મરૂદેવીકા નંદા.',
                  transliteration: 'Jaya Jaya Aarti Aadi Jinanda, Naabhiraya Maroodevika Nanda. Jaya Jaya Aarti Aadi Jinanda.',
                  translation_en: 'Victory, victory to the first Jina, Lord Adinath, the beloved son of King Nabhi and Queen Marudevi.'
                },
                {
                  timestamp_ms: 6000,
                  gujarati: 'પહેલી આરતી પૂજા કીજે, નર ભવ પામી ને લહાવો લીજે.',
                  transliteration: 'Pehli Aarti Puja Kije, Nar Bhav Paami Ne Lahavo Leeje.',
                  translation_en: 'Perform the first aarti and worship the Lord; having attained this rare human life, earn the spiritual profit.'
                },
                {
                  timestamp_ms: 12000,
                  gujarati: 'દુસરી આરતી દિન દયાલા, ધુલેવા મંડપ મા જગ અજવાલા.',
                  transliteration: 'Dusri Aarti Din Dayala, Dhuleva Mandap Ma Jag Ajwala.',
                  translation_en: 'The second aarti is to the merciful Lord of the humble, whose presence illuminates the great temple at Dhuleva.'
                },
                {
                  timestamp_ms: 18000,
                  gujarati: 'તીસરી આરતી ત્રિભુવન દેવા, સુર નર ઇન્દ્ર કરે તોરી સેવા.',
                  transliteration: 'Teesri Aarti Tribhuvan Deva, Sur Nar Indra Kare Tori Seva.',
                  translation_en: 'The third aarti is to the Lord of the three worlds, whom gods, humans, and Indras serve with devotion.'
                },
                {
                  timestamp_ms: 24000,
                  gujarati: 'ચોથી આરતી ચૌગતિ ચુરે, મન વાંછિત ફલ શિવ સુખ પુરે.',
                  transliteration: 'Chauthi Aarti Chaugati Chure, Mann Vanchhiit Fal Shiv Sukh Pure.',
                  translation_en: 'The fourth aarti destroys the cycle of the four destinies, fulfilling all pure desires and granting the bliss of liberation.'
                },
                {
                  timestamp_ms: 30000,
                  gujarati: 'પંચમી આરતી પુણ્ય ઉપાયો, મૂલચંદે ઋષભ ગુણ ગાયો.',
                  transliteration: 'Panchmi Aarti Punya Upaayo, Mulchande Rushabh Gun Gaayo. Jaya Jaya Aarti Aadi Jinanda.',
                  translation_en: 'Through the fifth aarti, spiritual merit is earned. The devotee Mulchand sings the glorious virtues of Lord Rishabhdev.'
                },
                {
                  timestamp_ms: 36000,
                  gujarati: 'નાભિરાયા મરૂદેવીકા નંદા.',
                  transliteration: 'Naabhiraya Maroodevika Nanda.',
                  translation_en: 'The beloved son of King Nabhi and Queen Marudevi.'
                }
              ]
            },
            {
              id: 'mangal-deevo',
              title: 'Mangal Deevo',
              artist: 'Kumarpal',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
              lines: [
                {
                  timestamp_ms: 0,
                  gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારી ને બહુ ચિરંજીવો.',
                  transliteration: 'Deevo re deevo prabhu mangalika deevo, Aarati utari ne bahu chiranjeevo.',
                  translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
                },
                {
                  timestamp_ms: 7000,
                  gujarati: 'સોહામણું ઘર પર્વ દિવાલી, અંબર ખેલે અમરા બાલી.',
                  transliteration: 'Sohamanu ghar parva dewali, Ambar khele amra bali.',
                  translation_en: 'The festival is as beautiful as Diwali in our homes, and the young gods in heaven celebrate with joy.'
                },
                {
                  timestamp_ms: 14000,
                  gujarati: 'દીપાલ ભણે અને એ કલિ કાલે, આરતી ઉતારી રાજા કુમારપાલે.',
                  transliteration: 'Depal bhane ane ae kali kale, Arati utari raja kumarpale.',
                  translation_en: 'The poet Depal sings that in this dark age of Kali-yuga, King Kumarpal performed this auspicious aarti.'
                },
                {
                  timestamp_ms: 21000,
                  gujarati: 'અમા ઘર મંગલીક, તુમ ઘર મંગલીક, મંગલીક ચતુર્વિધ સંઘ ને હોજો.',
                  transliteration: 'Ama ghar mangalika, tum ghar mangalika, Mangalika chaturvidha sangh ne hojo.',
                  translation_en: 'May there be auspiciousness in our homes, in your homes, and may there be auspiciousness for the entire four-fold Jain community.'
                },
                {
                  timestamp_ms: 28000,
                  gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારણા બહુ ચિરંજીવો.',
                  transliteration: 'Divo re divo prabhu magalic divo, Arati utarana bahu chiranjivo.',
                  translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
                }
              ]
            }
          ];
          const found = fallbackSongs.find(s => s.id === id);
          if (found) setSong(found);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void fetchSong();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a0522d" />
        </View>
      </SafeAreaView>
    );
  }

  if (!song) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.missWrap}>
          <Text style={styles.missTitle}>Song not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stepProgress = getStepProgress(song.id);
  const done = isCompleted(song.id) || (stepProgress.listen && stepProgress.learn_fill && stepProgress.recite);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.category}>{song.artist}</Text>
            {done ? (
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>🏅 Mastered</Text>
              </View>
            ) : (
              <Text style={styles.songLabel}>Devotional Song</Text>
            )}
          </View>
          <Text style={styles.title}>{song.title}</Text>
        </View>

        <Text style={styles.stepsHeading}>Your timing steps</Text>
        <View style={styles.stepsRow}>
          {STEPS.map(({ key, label, icon, doneIcon }) => {
            const complete = Boolean(stepProgress[key]);
            return (
              <View key={key} style={[styles.stepChip, complete && styles.stepChipDone]}>
                <Text style={styles.stepChipIcon}>{complete ? doneIcon : icon}</Text>
                <Text style={[styles.stepChipLabel, complete && styles.stepChipLabelDone]}>{label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Lyrics Preview</Text>
          {song.lines.map((line, idx) => (
            <View key={idx} style={styles.lineRow}>
              <Text style={styles.lineNumber}>{idx + 1}</Text>
              <View style={styles.lineContent}>
                {line.gujarati ? <Text style={styles.lineGujarati}>{line.gujarati}</Text> : null}
                <Text style={styles.lineTranslit}>{line.transliteration}</Text>
                <Text style={styles.lineTranslation}>{line.translation_en}</Text>
              </View>
            </View>
          ))}
        </View>

        {done && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>You've completed all stages for this song!</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            if (!stepProgress.listen) {
              router.push(`/song/listen/${song.id}` as any);
            } else if (!stepProgress.learn_fill) {
              router.push(`/song/fill/${song.id}` as any);
            } else if (!stepProgress.recite) {
              router.push(`/song/quiz/${song.id}` as any);
            } else {
              router.push(`/song/listen/${song.id}` as any); // Restart review flow
            }
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>
            {done
              ? 'Review karaoke sync'
              : !stepProgress.listen
                ? 'Start Karaoke (Level 1)'
                : !stepProgress.learn_fill
                  ? 'Continue to Fill-in (Level 2)'
                  : 'Continue to Quiz (Level 3)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf8f5' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  missWrap: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  missTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20 },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 12 },
  backText: { fontSize: 16, fontWeight: '600', color: '#a0522d' },

  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  category: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.85,
  },
  songLabel: { fontSize: 12, fontWeight: '700', color: '#888' },
  donePill: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  donePillText: { fontSize: 11, fontWeight: '700', color: '#2e7d32' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },

  stepsHeading: { fontSize: 14, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  stepsRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2d8cd',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  stepChipDone: {
    borderColor: '#a5d6a7',
    backgroundColor: '#e8f5e9',
  },
  stepChipIcon: { fontSize: 14 },
  stepChipLabel: { fontSize: 13, fontWeight: '700', color: '#666' },
  stepChipLabelDone: { color: '#2e7d32' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e8dfd6',
  },
  label: { fontSize: 14, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  lineRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0e9df' },
  lineNumber: { width: 28, fontSize: 13, fontWeight: '700', color: '#a0522d', marginTop: 2 },
  lineContent: { flex: 1, gap: 4 },
  lineGujarati: { fontSize: 15, fontWeight: '600', color: '#a0522d' },
  lineTranslit: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  lineTranslation: { fontSize: 13, color: '#666', lineHeight: 18 },

  doneBanner: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  doneBannerText: { color: '#2e7d32', fontWeight: '700', fontSize: 14 },

  primaryBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#a0522d',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
