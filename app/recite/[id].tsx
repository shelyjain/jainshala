import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';

type Line = {
  line_number: number;
  transliteration: string;
  translation_en: string;
};

type Sutra = {
  id: string;
  title: string;
  lines: Line[];
};

export default function ReciteSutra() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const isAlreadyRecited = stepProgress.recite;

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
      });
  }, [id]);

  const handleTap = (lineNumber: number) => {
    if (!revealed.includes(lineNumber)) {
      const updated = [...revealed, lineNumber];
      setRevealed(updated);
      if (sutra && updated.length === sutra.lines.length) {
        markStep(sutra.id, 'recite');
      }
    }
  };

  if (!sutra) return <View style={styles.container}><Text>Loading...</Text></View>;

  const allRevealed = sutra.lines.length > 0 && revealed.length === sutra.lines.length;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Exercise 2 of 2</Text>
      <Text style={styles.title}>Recite from memory</Text>
      <Text style={styles.subtitle}>Tap each line to reveal it</Text>

      {sutra.lines.map((line) => {
        const isRevealed = revealed.includes(line.line_number);
        return (
          <TouchableOpacity
            key={line.line_number}
            style={[styles.lineCard, isRevealed && styles.lineCardRevealed]}
            onPress={() => handleTap(line.line_number)}
            activeOpacity={0.7}
          >
            {!isRevealed ? (
              <Text style={styles.unrevealedText}>Tap to reveal</Text>
            ) : (
              <View style={styles.lineCardContent}>
                <Text style={styles.lineTranslit}>{line.transliteration}</Text>
                <Text style={styles.lineTranslation}>{line.translation_en}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      { (allRevealed || isAlreadyRecited) && (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => router.push(`/complete/${String(id)}`)}
        >
          <Text style={styles.completeBtnText}>Complete Sutra</Text>
        </TouchableOpacity>
      )}

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#555' },
  step: { fontSize: 12, color: '#a0522d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  lineCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 18, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  lineCardRevealed: { backgroundColor: '#fafafa', alignItems: 'flex-start', justifyContent: 'flex-start' },
  unrevealedText: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  lineCardContent: { flex: 1, width: '100%' },
  lineTranslit: { fontSize: 14, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 4 },
  lineTranslation: { fontSize: 12, color: '#888' },
  completeBtn: { backgroundColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16, marginBottom: 40 },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});