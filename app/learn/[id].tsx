import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
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
  const fillDone = stepProgress.learn_fill;

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setSutra(data);
        setShuffled(shuffle(data.lines));
      });
  }, [id]);

  const evaluateOrder = useCallback(
    (lines: Line[]) => {
      const correct = lines.every((line, idx) => line.line_number === idx + 1);
      setIsCorrectOrder(correct);
      setShowWrongHint(!correct);
      if (correct && sutra) {
        markStep(sutra.id, 'learn');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [markStep, sutra],
  );

  const moveLine = useCallback(
    (fromIndex: number, delta: number) => {
      setShuffled(prev => {
        const toIndex = fromIndex + delta;
        if (toIndex < 0 || toIndex >= prev.length) return prev;
        const next = [...prev];
        const [row] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, row);
        evaluateOrder(next);
        void Haptics.selectionAsync();
        return next;
      });
    },
    [evaluateOrder],
  );

  if (!sutra)
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );

  if (!fillDone && !isAlreadyLearned) {
    return (
      <View style={[styles.container, styles.gateWrap]}>
        <Text style={styles.gateTitle}>Level 2 first</Text>
        <Text style={styles.gateBody}>
          Complete the fill-in-the-blanks exercise, then return for the sequence challenge.
        </Text>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.replace(`/learn-blanks/${String(id)}` as any)}
        >
          <Text style={styles.nextBtnText}>Open Level 2</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allSelected = isCorrectOrder;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Line>) => {
    const idx = getIndex() ?? 0;
    const last = shuffled.length - 1;
    const shouldBe = idx + 1;
    const isInRightSpot = item.line_number === shouldBe;
    const cardStyle = [
      styles.lineCard,
      isActive && styles.lineCardDragging,
      !isActive && isInRightSpot && styles.lineCardCorrect,
    ];

    return (
      <TouchableOpacity
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          drag();
        }}
        delayLongPress={140}
        activeOpacity={0.92}
        disabled={isActive}
        style={cardStyle}
      >
        <View style={styles.dragHandle} collapsable={false}>
          <Text style={styles.dragHandleText}>≡</Text>
        </View>
        <View style={styles.lineCardContent}>
          <Text style={styles.lineTranslit}>{item.transliteration}</Text>
          <Text style={styles.lineTranslation}>{item.translation_en}</Text>
        </View>

        <View style={styles.arrowCol}>
          <TouchableOpacity
            style={[styles.arrowBtn, idx === 0 && styles.arrowBtnDisabled]}
            disabled={idx === 0 || isActive}
            hitSlop={{ top: 6, bottom: 4, left: 8, right: 8 }}
            onPress={() => moveLine(idx, -1)}
          >
            <Text style={[styles.arrowText, idx === 0 && styles.arrowTextDisabled]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, idx === last && styles.arrowBtnDisabled]}
            disabled={idx === last || isActive}
            hitSlop={{ top: 4, bottom: 6, left: 8, right: 8 }}
            onPress={() => moveLine(idx, 1)}
          >
            <Text style={[styles.arrowText, idx === last && styles.arrowTextDisabled]}>↓</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.positionMark, isInRightSpot && styles.positionMarkCorrect]}>
          {isInRightSpot ? '✓' : shouldBe}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPlaceholder = () => (
    <View style={styles.placeholderCard} pointerEvents="none" collapsable={false} />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerSection, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.step}>Level 3 of 3 · Sequence</Text>
        <Text style={styles.title}>Put lines in order</Text>
        <Text style={styles.subtitle}>{sutra.title}</Text>

        <View style={styles.progressRow}>
          {sutra.lines.map((_, i) => (
            <View key={i} style={[styles.progressDot, isCorrectOrder && styles.progressDotFilled]} />
          ))}
        </View>

        <Text style={styles.hint}>
          {allSelected
            ? `Perfect! Mantra sequence is correct.`
            : showWrongHint
              ? `Keep reordering until each line matches its numbered slot.`
              : `Use ↑ ↓ on each row, or hold a row until it lifts, then drag.`}
        </Text>
      </View>

      <DraggableFlatList
        data={shuffled}
        keyExtractor={item => String(item.line_number)}
        renderItem={renderItem}
        renderPlaceholder={renderPlaceholder}
        onDragEnd={({ data }) => {
          setShuffled(data);
          evaluateOrder(data);
        }}
        activationDistance={0}
        dragItemOverflow
        containerStyle={styles.listContainer}
        ListFooterComponent={<View style={styles.listFooterSpacer} />}
        autoscrollSpeed={260}
        autoscrollThreshold={60}
        style={styles.list}
        scrollEnabled
        nestedScrollEnabled={Platform.OS === 'android'}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
      />

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(12, insets.bottom + 8),
          },
        ]}
      >
        {(allSelected || isAlreadyLearned) && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => router.push(`/complete/${String(id)}` as any)}
          >
            <Text style={styles.nextBtnText}>
              {allSelected ? 'Complete Sutra 🏅' : 'Finish & earn badge →'}
            </Text>
          </TouchableOpacity>
        )}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gateWrap: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  gateTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  gateBody: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  headerSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  listContainer: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  listFooterSpacer: { height: 8 },
  bottomBar: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 16, color: '#555' },
  step: {
    fontSize: 12,
    color: '#a0522d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 12 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e0e0e0' },
  progressDotFilled: { backgroundColor: '#a0522d' },
  hint: { fontSize: 13, color: '#a0522d', marginBottom: 0, fontWeight: '500', lineHeight: 20 },
  nextBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lineCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
  },
  lineCardDragging: {
    backgroundColor: '#fdf0e8',
    borderColor: '#a0522d',
    borderWidth: 1.5,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 999,
  },
  lineCardCorrect: { backgroundColor: '#f0faf0', borderColor: '#4caf50' },
  placeholderCard: {
    backgroundColor: '#efefef',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    minHeight: 76,
  },
  dragHandle: { width: 32, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  dragHandleText: { fontSize: 22, color: '#a0522d', lineHeight: 22 },
  lineCardContent: { flex: 1, minWidth: 0 },
  arrowCol: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    gap: 2,
  },
  arrowBtn: {
    minWidth: 36,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7cbbf',
  },
  arrowBtnDisabled: { opacity: 0.35 },
  arrowText: { fontSize: 18, fontWeight: '700', color: '#a0522d', textAlign: 'center' },
  arrowTextDisabled: { color: '#bbb' },
  positionMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    backgroundColor: '#f1f1f1',
    color: '#888',
    fontWeight: '700',
    lineHeight: 28,
    fontSize: 12,
  },
  positionMarkCorrect: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  lineTranslit: { fontSize: 14, color: '#1a1a1a', fontStyle: 'italic', marginBottom: 2 },
  lineTranslation: { fontSize: 12, color: '#888' },
  resetBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 14, color: '#888' },
});
