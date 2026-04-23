import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useProgress } from '../../hooks/use-progress';
import { API_URL } from '../../constants/api';
import { fetchJson } from '../../lib/fetch-json';

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


export default function HomeScreen() {
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();
  const { isCompleted, completed, getStepProgress } = useProgress();

  useFocusEffect(
    useCallback(() => {}, [completed])
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchJson<Sutra[]>(`${API_URL}/sutras`)
      .then((data) => {
        if (!cancelled) {
          setSutras(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load sutras');
          setSutras([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url =
      query.trim() === ''
        ? `${API_URL}/sutras`
        : `${API_URL}/search?q=${encodeURIComponent(query)}`;

    fetchJson<Sutra[]>(url)
      .then((data) => {
        if (!cancelled) setSutras(data);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Request failed');
          setSutras([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  const completedCount = sutras.filter(s => isCompleted(s.id)).length;
  const progressPct = sutras.length ? (completedCount / sutras.length) * 100 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Jain Archive</Text>
      {loadError ? (
        <Text style={styles.errorText}>
          Could not reach API at {API_URL}. From the project folder run: cd backend then uvicorn main:app --reload --host 0.0.0.0 --port 8000. Then reload the app.{'\n'}
          {loadError}
        </Text>
      ) : null}
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>{completedCount} / {sutras.length} sutras completed</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>
      <TextInput
        style={styles.searchBar}
        placeholder="Search sutras..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={sutras}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const done = isCompleted(item.id);
          const stepProgress = getStepProgress(item.id);
          const stepsCount = (stepProgress.read ? 1 : 0) + (stepProgress.listen ? 1 : 0) + (stepProgress.learn ? 1 : 0) + (stepProgress.recite ? 1 : 0);
          const isFullyDone = done || stepsCount === 4;

          return (
            <TouchableOpacity
              style={[styles.card, isFullyDone && styles.cardDone]}
              onPress={() => router.push(`/sutra/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                {isFullyDone ? (
                  <Text style={styles.badge}>🏅 Complete</Text>
                ) : stepsCount > 0 ? (
                  <Text style={[styles.badge, styles.badgePartial]}>{stepsCount}/4 Completed</Text>
                ) : null}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardFirstLine}>{item.lines[0].transliteration}</Text>
              <Text style={styles.cardTranslation}>{item.lines[0].translation_en}</Text>
              <View style={styles.tagsRow}>
                {item.tags.map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 28, fontWeight: '600', marginBottom: 12, color: '#1a1a1a' },
  progressBar: { marginBottom: 16 },
  progressText: { fontSize: 13, color: '#888', marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: '#f0ebe3', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#a0522d', borderRadius: 3 },
  searchBar: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, color: '#1a1a1a' },
  card: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#e0e0e0' },
  cardDone: { borderColor: '#a0522d', backgroundColor: '#fdf8f4' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardCategory: { fontSize: 11, fontWeight: '600', color: '#a0522d', textTransform: 'uppercase', letterSpacing: 0.8 },
  badge: { fontSize: 12, color: '#a0522d', fontWeight: '600' },
  badgePartial: { color: '#888', fontWeight: '500' },
  errorText: {
    fontSize: 14,
    color: '#b00020',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  cardFirstLine: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 2 },
  cardTranslation: { fontSize: 13, color: '#888', marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#f0ebe3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: '#a0522d' },
});