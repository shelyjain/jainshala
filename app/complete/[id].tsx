import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';

export default function Complete() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const { markComplete } = useProgress();

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => setTitle(data.title));
      
    if (id) {
      markComplete(String(id));
    }
  }, [id]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🏅</Text>
      <Text style={styles.heading}>Sutra Complete!</Text>
      <Text style={styles.subtitle}>{title}</Text>
      <Text style={styles.body}>You've read, ordered and recited this sutra. Badge earned!</Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/')}
      >
        <Text style={styles.btnText}>Back to Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnOutline}
        onPress={() => router.push(`/sutra/${id}`)}
      >
        <Text style={styles.btnOutlineText}>Review Sutra</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 100, alignItems: 'center' },
  emoji: { fontSize: 80, marginBottom: 24 },
  heading: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#a0522d', fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 48 },
  btn: { backgroundColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', width: '100%', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: { borderWidth: 1.5, borderColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', width: '100%' },
  btnOutlineText: { color: '#a0522d', fontSize: 16, fontWeight: '600' },
});