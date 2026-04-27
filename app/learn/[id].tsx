import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const [sutra, setSutra] = useState<Sutra | null>(null);
  const [shuffled, setShuffled] = useState<Line[]>([]);
  const [isCorrectOrder, setIsCorrectOrder] = useState(false);
  const [showWrongHint, setShowWrongHint] = useState(false);
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

  const evaluateOrder = (lines: Line[]) => {
    const correct = lines.every((line, idx) => line.line_number === idx + 1);
    setIsCorrectOrder(correct);
    setShowWrongHint(!correct);
    if (correct && sutra) {
      markStep(sutra.id, 'learn');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  if (!sutra) return <View style={styles.container}><Text>Loading...</Text></View>;

  const allSelected = isCorrectOrder;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Line>) => {
    const idx = getIndex() ?? 0;
    const shouldBe = idx + 1;
    const isInRightSpot = item.line_number === shouldBe;
    const cardStyle = isActive
      ? [styles.lineCard, styles.lineCardDragging]
      : isInRightSpot
        ? [styles.lineCard, styles.lineCardCorrect]
        : [styles.lineCard];

    return (
      <TouchableOpacity style={cardStyle} activeOpacity={0.95}>
        <TouchableOpacity
          style={styles.dragHandle}
          onPressIn={() => {
            void Haptics.selectionAsync();
            drag();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.dragHandleText}>≡</Text>
        </TouchableOpacity>
        <View style={styles.lineCardContent}>
          <Text style={styles.lineTranslit}>{item.transliteration}</Text>
          <Text style={styles.lineTranslation}>{item.translation_en}</Text>
        </View>
        <Text style={[styles.positionMark, isInRightSpot && styles.positionMarkCorrect]}>
          {isInRightSpot ? '✓' : shouldBe}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={shuffled}
        keyExtractor={item => String(item.line_number)}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          setShuffled(data);
          evaluateOrder(data);
        }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.step}>Exercise 1 of 3</Text>
            <Text style={styles.title}>Drag lines in order</Text>
            <Text style={styles.subtitle}>{sutra.title}</Text>

            <View style={styles.progressRow}>
              {sutra.lines.map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, isCorrectOrder && styles.progressDotFilled]}
                />
              ))}
            </View>

            <Text style={styles.hint}>
              {allSelected
                ? `Perfect! Mantra sequence is correct.`
                : showWrongHint
                  ? `Keep dragging until all lines are in the correct sequence.`
                  : `Long-press and drag each line to build the correct sequence.`}
            </Text>

            {(allSelected || isAlreadyLearned) && (
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => router.push(`/recite/${String(id)}`)}
              >
                <Text style={styles.nextBtnText}>{allSelected ? 'Next Exercise →' : 'Skip to Next Exercise →'}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              const restarted = shuffle(sutra.lines);
              setShuffled(restarted);
              setIsCorrectOrder(false);
              setShowWrongHint(false);
            }}
          >
            <Text style={styles.resetBtnText}>Shuffle & Restart</Text>
          </TouchableOpacity>
        }
        activationDistance={8}
        autoscrollSpeed={180}
        autoscrollThreshold={80}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(40, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 60 },
  headerWrap: { paddingTop: 4 },
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
  lineCardDragging: { backgroundColor: '#fdf0e8', borderColor: '#a0522d' },
  lineCardCorrect: { backgroundColor: '#f0faf0', borderColor: '#4caf50' },
  dragHandle: { width: 24, alignItems: 'center', marginRight: 8 },
  dragHandleText: { fontSize: 20, color: '#a0522d', lineHeight: 20 },
  lineCardContent: { flex: 1 },
  positionMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    backgroundColor: '#f1f1f1',
    color: '#888',
    fontWeight: '700',
    marginLeft: 8,
    lineHeight: 26,
    fontSize: 12,
  },
  positionMarkCorrect: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  lineTranslit: { fontSize: 14, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 2 },
  lineTranslation: { fontSize: 12, color: '#888' },
  resetBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  resetBtnText: { fontSize: 14, color: '#888' },
});