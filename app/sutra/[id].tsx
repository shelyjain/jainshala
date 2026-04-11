import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  if (!sutra) return (
    <View style={styles.container}>
      <Text>Sutra not found</Text>
    </View>
  );

  const done = isCompleted(sutra.id);
  const stepProgress = getStepProgress(sutra.id);

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.category}>{sutra.category}</Text>
          <Text style={styles.title}>{sutra.title}</Text>
        </View>
        {done && <Text style={styles.badge}>🏅</Text>}
      </View>

      <View style={styles.stepsTracker}>
        <View style={styles.stepBubble}>
          <Text style={styles.stepBubbleText}>{stepProgress.read ? '✅ Read' : '📖 Read'}</Text>
        </View>
        <View style={styles.stepBubble}>
          <Text style={styles.stepBubbleText}>{stepProgress.learn ? '✅ Learn' : '🧠 Learn'}</Text>
        </View>
        <View style={styles.stepBubble}>
          <Text style={styles.stepBubbleText}>{stepProgress.recite ? '✅ Recite' : '🗣️ Recite'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Line by Line</Text>
        {sutra.lines.map(line => (
          <View key={line.line_number} style={styles.lineRow}>
            <Text style={styles.lineNumber}>{line.line_number}.</Text>
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
        <View style={styles.doneMessage}>
          <Text style={styles.doneMessageText}>You've already learned this sutra!</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.learnBtn}
        onPress={() => {
          markStep(sutra.id, 'read');
          if (stepProgress.learn && !stepProgress.recite) {
            router.push(`/recite/${sutra.id}` as any);
          } else {
            router.push(`/learn/${sutra.id}` as any);
          }
        }}
      >
        <Text style={styles.learnBtnText}>
          {done ? '🏅 Review again!' : (stepProgress.learn ? '⏭️ Continue to Recite' : '🎓 Start Learning')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#555' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  badge: { fontSize: 28 },
  category: { fontSize: 11, fontWeight: '600', color: '#a0522d', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a' },
  stepsTracker: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  stepBubble: { backgroundColor: '#fdf8f4', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#f0ebe3' },
  stepBubbleText: { fontSize: 12, color: '#a0522d', fontWeight: '600' },
  section: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
  label: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  lineRow: { flexDirection: 'row', marginBottom: 14 },
  lineNumber: { fontSize: 13, color: '#a0522d', fontWeight: '600', marginRight: 10, marginTop: 2, width: 20 },
  lineContent: { flex: 1 },
  lineTranslit: { fontSize: 15, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 3 },
  lineTranslation: { fontSize: 13, color: '#666' },
  interpretation: { fontSize: 15, color: '#444', lineHeight: 24 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: { backgroundColor: '#f0ebe3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, color: '#a0522d' },
  doneMessage: { backgroundColor: '#fdf8f4', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center', borderColor: '#a0522d', borderWidth: 1 },
  doneMessageText: { color: '#a0522d', fontWeight: '600', fontSize: 14 },
  learnBtn: { backgroundColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 40 },
  learnBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});