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

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function LearnOrder() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [shuffled, setShuffled] = useState<Line[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const { markStep, getStepProgress } = useProgress();
  const stepProgress = getStepProgress(String(id));
  const isAlreadyLearned = stepProgress.learn;

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
        setShuffled(shuffle(data.lines));
      });
  }, [id]);

  const handleTap = (line: Line) => {
    if (selected.includes(line.line_number)) return;
    const nextExpected = selected.length + 1;
    if (line.line_number === nextExpected) {
      const updated = [...selected, line.line_number];
      setSelected(updated);
      setWrong(null);
      if (sutra && updated.length === sutra.lines.length) {
        markStep(sutra.id, 'learn');
      }
    } else {
      setWrong(line.line_number);
      setTimeout(() => setWrong(null), 600);
    }
  };

  const getCardStyle = (line: Line) => {
    if (selected.includes(line.line_number)) return [styles.lineCard, styles.lineCardCorrect];
    if (wrong === line.line_number) return [styles.lineCard, styles.lineCardWrong];
    return [styles.lineCard];
  };

  if (!sutra) return <View style={styles.container}><Text>Loading...</Text></View>;

  const allSelected = selected.length === sutra.lines.length;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Exercise 1 of 2</Text>
      <Text style={styles.title}>Tap lines in order</Text>
      <Text style={styles.subtitle}>{sutra.title}</Text>

      <View style={styles.progressRow}>
        {sutra.lines.map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, selected.length > i && styles.progressDotFilled]}
          />
        ))}
      </View>

      <Text style={styles.hint}>
        {allSelected
          ? `All ${sutra.lines.length} lines selected!`
          : `Tap line ${selected.length + 1} of ${sutra.lines.length}`}
      </Text>

      { (allSelected || isAlreadyLearned) && (
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.push(`/recite/${String(id)}`)}
        >
          <Text style={styles.nextBtnText}>{allSelected ? 'Next Exercise →' : 'Skip to Next Exercise →'}</Text>
        </TouchableOpacity>
      )}

      {shuffled.map(line => (
        <TouchableOpacity
          key={line.line_number}
          style={getCardStyle(line)}
          onPress={() => handleTap(line)}
        >
          <View style={styles.lineCardContent}>
            <Text style={styles.lineTranslit}>{line.transliteration}</Text>
            <Text style={styles.lineTranslation}>{line.translation_en}</Text>
          </View>
          {selected.includes(line.line_number) && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() => {
          setSelected([]);
          setShuffled(shuffle(sutra.lines));
        }}
      >
        <Text style={styles.resetBtnText}>Shuffle & Restart</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#555' },
  step: { fontSize: 12, color: '#a0522d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e0e0e0' },
  progressDotFilled: { backgroundColor: '#a0522d' },
  hint: { fontSize: 13, color: '#a0522d', marginBottom: 12, fontWeight: '500' },
  nextBtn: { backgroundColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 16 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lineCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center' },
  lineCardCorrect: { backgroundColor: '#f0faf0', borderColor: '#4caf50' },
  lineCardWrong: { backgroundColor: '#fff0f0', borderColor: '#e57373' },
  lineCardContent: { flex: 1 },
  lineTranslit: { fontSize: 14, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 2 },
  lineTranslation: { fontSize: 12, color: '#888' },
  checkmark: { fontSize: 18, color: '#4caf50', marginLeft: 8 },
  resetBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  resetBtnText: { fontSize: 14, color: '#888' },
});