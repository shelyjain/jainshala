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
import { useProgress } from '../../hooks/use-progress';
import { API_URL } from '../../constants/api';

type Line = {
  line_number: number;
  transliteration: string;
  translation_en: string;
};

type Sutra = {
  id: string;
  title: string;
  category: string;
  sutra_number: number;
  original_gu: string;
  original_hi: string;
  lines: Line[];
  interpretation: string;
  tags: string[];
};

const STEPS = [
  { key: 'read' as const, label: 'Read', icon: '📖', doneIcon: '✓' },
  { key: 'listen' as const, label: 'Listen', icon: '🎧', doneIcon: '✓' },
  { key: 'learn' as const, label: 'Order', icon: '🔢', doneIcon: '✓' },
  { key: 'learn_fill' as const, label: 'Fill', icon: '✏️', doneIcon: '✓' },
  { key: 'recite' as const, label: 'Quiz', icon: '❓', doneIcon: '✓' },
];

export default function SutraDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [loading, setLoading] = useState(true);
  const { isCompleted, markStep, getStepProgress } = useProgress();

  useEffect(() => {
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

  if (!sutra) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.missWrap}>
          <Text style={styles.missTitle}>Sutra not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const done = isCompleted(sutra.id);
  const stepProgress = getStepProgress(sutra.id);

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
            <Text style={styles.category}>{sutra.category}</Text>
            {done ? (
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>🏅 Mastered</Text>
              </View>
            ) : (
              <Text style={styles.sutraNum}>Sutra {sutra.sutra_number}</Text>
            )}
          </View>
          <Text style={styles.title}>{sutra.title}</Text>
        </View>

        <Text style={styles.stepsHeading}>Your steps</Text>
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
          <Text style={styles.label}>Line by line</Text>
          {sutra.lines.map(line => (
            <View key={line.line_number} style={styles.lineRow}>
              <Text style={styles.lineNumber}>{line.line_number}</Text>
              <View style={styles.lineContent}>
                <Text style={styles.lineTranslit}>{line.transliteration}</Text>
                <Text style={styles.lineTranslation}>{line.translation_en}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Interpretation</Text>
          <Text style={styles.interpretation}>{sutra.interpretation}</Text>
        </View>

        <View style={styles.tagsContainer}>
          {sutra.tags.map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {done && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>{`You've completed all steps for this sutra.`}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push(`/flashcard/${sutra.id}` as any)}
          activeOpacity={0.88}
        >
          <Text style={styles.secondaryBtnText}>Flashcards & listen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            markStep(sutra.id, 'read');
            if (stepProgress.recite) {
              router.push(`/flashcard/${sutra.id}` as any);
            } else if (stepProgress.learn_fill) {
              router.push(`/recite/${sutra.id}` as any);
            } else if (stepProgress.learn) {
              router.push(`/learn-blanks/${sutra.id}` as any);
            } else if (stepProgress.listen) {
              router.push(`/learn/${sutra.id}` as any);
            } else {
              router.push(`/flashcard/${sutra.id}` as any);
            }
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>
            {done
              ? 'Review learning path'
              : stepProgress.learn_fill
                ? 'Continue to quiz (level 3)'
                : stepProgress.learn
                  ? 'Continue to fill-in-the-blanks (level 2)'
                  : stepProgress.listen
                    ? 'Continue to sequence (level 1)'
                    : 'Start learning'}
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
  missWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  missTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center' },

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
  sutraNum: { fontSize: 12, fontWeight: '700', color: '#888' },
  donePill: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  donePillText: { fontSize: 11, fontWeight: '800', color: '#2e7d32' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', lineHeight: 30 },

  stepsHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5ded4',
  },
  stepChipDone: {
    backgroundColor: '#f1f8e9',
    borderColor: '#c5e1a5',
  },
  stepChipIcon: { fontSize: 13 },
  stepChipLabel: { fontSize: 12, fontWeight: '700', color: '#666' },
  stepChipLabelDone: { color: '#33691e' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ebe3da',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 14,
  },
  lineRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0ebe3',
  },
  lineNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a0522d',
    width: 28,
    marginTop: 2,
  },
  lineContent: { flex: 1 },
  lineTranslit: { fontSize: 15, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 4, lineHeight: 22 },
  lineTranslation: { fontSize: 13, color: '#555', lineHeight: 20 },
  interpretation: { fontSize: 15, color: '#444', lineHeight: 24 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  tag: {
    backgroundColor: '#f0ebe3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 12, color: '#a0522d', fontWeight: '600' },

  doneBanner: {
    backgroundColor: '#fffbf0',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8d5a8',
  },
  doneBannerText: { color: '#6d4c41', fontWeight: '600', fontSize: 14, textAlign: 'center' },

  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#a0522d',
  },
  secondaryBtnText: { color: '#a0522d', fontSize: 16, fontWeight: '700' },

  primaryBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
