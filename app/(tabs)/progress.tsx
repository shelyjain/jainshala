import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
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
  lines: Line[];
  tags: string[];
};

export default function ProgressScreen() {
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isCompleted, completed } = useProgress();

  useFocusEffect(
    useCallback(() => {
      // Re-render when nav focus comes back since completed may have changed
    }, [completed])
  );

  useEffect(() => {
    fetch(`${API_URL}/sutras`)
      .then(res => res.json())
      .then(data => {
        setSutras(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  const completedCount = sutras.filter(s => isCompleted(s.id)).length;
  const completedSutras = sutras.filter(s => isCompleted(s.id));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Progress</Text>
      
      <View style={styles.statsCard}>
        <Text style={styles.statsEmoji}>🏅</Text>
        <Text style={styles.statsBigNumber}>{completedCount}</Text>
        <Text style={styles.statsSubtitle}>Badges Earned</Text>
        <Text style={styles.statsDetail}>
          You've learned {completedCount} out of {sutras.length} sutras!
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Earned Badges</Text>
      
      {completedSutras.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You haven't earned any badges yet. Start learning your first sutra!</Text>
        </View>
      ) : (
        <FlatList
          data={completedSutras}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/sutra/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <Text style={styles.badge}>🏅 Learned</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardFirstLine}>{item.lines[0]?.transliteration}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 28, fontWeight: '600', marginBottom: 24, color: '#1a1a1a' },
  statsCard: { backgroundColor: '#fdf8f4', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#a0522d' },
  statsEmoji: { fontSize: 40, marginBottom: 8 },
  statsBigNumber: { fontSize: 48, fontWeight: '800', color: '#a0522d', marginBottom: 4 },
  statsSubtitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  statsDetail: { fontSize: 14, color: '#666' },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 16 },
  emptyState: { padding: 20, alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 12 },
  emptyText: { color: '#888', textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#a0522d', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardCategory: { fontSize: 11, fontWeight: '600', color: '#a0522d', textTransform: 'uppercase', letterSpacing: 0.8 },
  badge: { fontSize: 12, color: '#a0522d', fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  cardFirstLine: { fontSize: 13, color: '#666', fontStyle: 'italic' },
});
