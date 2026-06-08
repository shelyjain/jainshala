import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listSutrasFromFirestore } from '../../../lib/firestore-sutras';
import type { Sutra } from '../../../types/sutra';

export default function AdminSutrasListScreen() {
  const router = useRouter();
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSutrasFromFirestore();
      setSutras(data);
    } catch {
      Alert.alert('Error', 'Could not load sutras from Firestore.');
      setSutras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/sutras/new')}>
        <Text style={styles.addBtnText}>+ Upload new sutra</Text>
      </TouchableOpacity>

      {loading && sutras.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#a0522d" />
      ) : (
        <FlatList
          data={sutras}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/admin/sutras/${item.id}`)}
            >
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.sutra_number}. {item.title}
              </Text>
              <Text style={styles.rowMeta}>{item.category}</Text>
              {item.badgeEpithet ? (
                <Text style={styles.badgeMeta}>
                  {item.badgeEmoji ?? '🏅'} {item.badgeEpithet}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No sutras in Firestore yet. Run `python seed_sutras.py` in the backend folder, then
              refresh.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  addBtn: {
    margin: 16,
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rowMeta: { fontSize: 13, color: '#888', marginTop: 4 },
  badgeMeta: { fontSize: 12, color: '#a0522d', marginTop: 6 },
  empty: { textAlign: 'center', color: '#888', padding: 32, lineHeight: 22 },
});
