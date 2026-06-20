import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

type VidhiLine = {
  line_number: number;
  transliteration: string;
  translation_en: string;
};

type VidhiItem = {
  id: string;
  title: string;
  category: string;
  lines: VidhiLine[];
  interpretation: string;
};

const VIDHI_DATA: Record<string, VidhiItem> = {
  aarti: {
    id: 'aarti',
    title: 'Shree Adinath Aarti',
    category: 'Vidhi',
    interpretation: 'The Aarti is a beautiful ritual of waving lamps before the Lord, symbolizing the dispelling of inner darkness and the illumination of the soul. This Aarti glorifies Adinath Bhagwan (Rishabhdev), the first Tirthankara, celebrating his divine birth to King Nabhi and Queen Marudevi, and inspiring us to use our human life for spiritual liberation.',
    lines: [
      {
        line_number: 1,
        transliteration: 'Jaya Jaya Aarti Aadi Jinanda, Naabhiraya Maroodevika Nanda. Jaya Jaya Aarti Aadi Jinanda.',
        translation_en: 'Victory, victory to the first Jina, Lord Adinath, the beloved son of King Nabhi and Queen Marudevi.'
      },
      {
        line_number: 2,
        transliteration: 'Pehli Aarti Puja Kije, Nar Bhav Paami Ne Lahavo Leeje.',
        translation_en: 'Perform the first aarti and worship the Lord; having attained this rare human life, earn the spiritual profit.'
      },
      {
        line_number: 3,
        transliteration: 'Dusri Aarti Din Dayala, Dhuleva Mandap Ma Jag Ajwala.',
        translation_en: 'The second aarti is to the merciful Lord of the humble, whose presence illuminates the great temple at Dhuleva.'
      },
      {
        line_number: 4,
        transliteration: 'Teesri Aarti Tribhuvan Deva, Sur Nar Indra Kare Tori Seva.',
        translation_en: 'The third aarti is to the Lord of the three worlds, whom gods, humans, and Indras serve with devotion.'
      },
      {
        line_number: 5,
        transliteration: 'Chauthi Aarti Chaugati Chure, Mann Vanchhiit Fal Shiv Sukh Pure.',
        translation_en: 'The fourth aarti destroys the cycle of the four destinies, fulfilling all pure desires and granting the bliss of liberation.'
      },
      {
        line_number: 6,
        transliteration: 'Panchmi Aarti Punya Upaayo, Mulchande Rushabh Gun Gaayo. Jaya Jaya Aarti Aadi Jinanda.',
        translation_en: 'Through the fifth aarti, spiritual merit is earned. The devotee Mulchand sings the glorious virtues of Lord Rishabhdev.'
      },
      {
        line_number: 7,
        transliteration: 'Naabhiraya Maroodevika Nanda.',
        translation_en: 'The beloved son of King Nabhi and Queen Marudevi.'
      }
    ]
  },
  'mangal-deevo': {
    id: 'mangal-deevo',
    title: 'Mangal Deevo',
    category: 'Vidhi',
    interpretation: 'The Mangal Deevo is performed after the Aarti. Waving a single-wick lamp symbolizes Keval Jnana (Absolute/Perfect Knowledge), the ultimate state of soul-realization. It is historically associated with King Kumarpal and prays for universal peace, prosperity, and auspiciousness for all living beings.',
    lines: [
      {
        line_number: 1,
        transliteration: 'Deevo re deevo prabhu mangalika deevo, Aarati utari ne bahu chiranjeevo.',
        translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
      },
      {
        line_number: 2,
        transliteration: 'Sohamanu ghar parva dewali, Ambar khele amra bali.',
        translation_en: 'The festival is as beautiful as Diwali in our homes, and the young gods in heaven celebrate with joy.'
      },
      {
        line_number: 3,
        transliteration: 'Depal bhane ane ae kali kale, Arati utari raja kumarpale.',
        translation_en: 'The poet Depal sings that in this dark age of Kali-yuga, King Kumarpal performed this auspicious aarti.'
      },
      {
        line_number: 4,
        transliteration: 'Ama ghar mangalika, tum ghar mangalika, Mangalika chaturvidha sangh ne hojo.',
        translation_en: 'May there be auspiciousness in our homes, in your homes, and may there be auspiciousness for the entire four-fold Jain community.'
      },
      {
        line_number: 5,
        transliteration: 'Divo re divo prabhu magalic divo, Arati utarana bahu chiranjivo.',
        translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
      }
    ]
  }
};

export default function VidhiScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [speakingLine, setSpeakingLine] = useState<number | null>(null);

  const item = VIDHI_DATA[String(id)];

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.missWrap}>
          <Text style={styles.missTitle}>Ritual not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSpeak = (line: VidhiLine) => {
    if (speakingLine === line.line_number) {
      Speech.stop();
      setSpeakingLine(null);
    } else {
      Speech.stop();
      setSpeakingLine(line.line_number);
      Speech.speak(line.transliteration, {
        language: 'hi-IN',
        rate: 0.72,
        pitch: 0.98,
        onDone: () => {
          setSpeakingLine(null);
        },
        onError: () => {
          setSpeakingLine(null);
        }
      });
    }
  };

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
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.lampIcon}>{id === 'aarti' ? '🪔' : '🕯️'}</Text>
          </View>
          <Text style={styles.title}>{item.title}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Interpretation & Meaning</Text>
          <Text style={styles.interpretation}>{item.interpretation}</Text>
        </View>

        <Text style={styles.sectionHeading}>Lyrics & Recitation</Text>
        {item.lines.map(line => {
          const isCurrentSpeaking = speakingLine === line.line_number;
          return (
            <View key={line.line_number} style={[styles.lineCard, isCurrentSpeaking && styles.lineCardActive]}>
              <View style={styles.lineHeader}>
                <View style={styles.lineNumberBadge}>
                  <Text style={styles.lineNumberText}>{line.line_number}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.speakBtn, isCurrentSpeaking && styles.speakBtnActive]}
                  onPress={() => handleSpeak(line)}
                >
                  <Text style={styles.speakBtnText}>{isCurrentSpeaking ? '⏸ Stop' : '🔊 Play'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.lineTranslit, isCurrentSpeaking && styles.lineTranslitActive]}>
                {line.transliteration}
              </Text>
              <Text style={styles.lineTranslation}>{line.translation_en}</Text>
            </View>
          );
        })}
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
  missWrap: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  missTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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
    fontSize: 11,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.85,
  },
  lampIcon: { fontSize: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', lineHeight: 32 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ebe3da',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  interpretation: { fontSize: 14, color: '#444', lineHeight: 22 },

  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  lineCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  lineCardActive: {
    borderColor: '#a0522d',
    backgroundColor: '#fffdfb',
    borderWidth: 1.5,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lineNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0ebe3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineNumberText: { fontSize: 12, fontWeight: '700', color: '#a0522d' },
  speakBtn: {
    backgroundColor: '#faf6f2',
    borderWidth: 1,
    borderColor: '#e8dfd6',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  speakBtnActive: {
    backgroundColor: '#fdf0e8',
    borderColor: '#a0522d',
  },
  speakBtnText: { fontSize: 12, fontWeight: '700', color: '#a0522d' },
  lineTranslit: { fontSize: 16, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 6, lineHeight: 24, fontWeight: '500' },
  lineTranslitActive: { color: '#a0522d' },
  lineTranslation: { fontSize: 13, color: '#666', lineHeight: 20 },
});
