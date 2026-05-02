import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProgress } from '../../hooks/use-progress';
import { API_URL } from '../../constants/api';
import { fetchJson } from '../../lib/fetch-json';
import { AppLogo } from '@/components/app-logo';
import { MASTER_BADGE, hasEarnedMasterBadge } from '@/constants/master-badge';

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

type Milestone = {
  sutra: Sutra;
  stepsDone: number;
  fullyDone: boolean;
};

const STEP_KEYS = ['read', 'listen', 'learn', 'learn_fill', 'recite'] as const;
const TOTAL_STEPS = STEP_KEYS.length;

/** Spine column width — track draws continuous vertical road inside each row. */
const SPINE_W = 44;
const SPINE_TRACK_W = 10;
/** Fixed connector above finish jewel (ties last row to footer node). */
const FOOTER_SPINE_BRIDGE = 22;

function countSteps(p: Record<(typeof STEP_KEYS)[number], boolean>): number {
  return STEP_KEYS.reduce((n, k) => n + (p[k] ? 1 : 0), 0);
}

export default function HomeScreen() {
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();
  const { completed, getStepProgress } = useProgress();

  useFocusEffect(useCallback(() => {}, [completed]));

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchJson<Sutra[]>(`${API_URL}/sutras`)
      .then(data => {
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
      .then(data => {
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

  /** Canonical sutra order — always by catalog number so the path never looks scrambled (including search). */
  const ordered = useMemo(() => {
    return [...sutras].sort((a, b) => (a.sutra_number ?? 0) - (b.sutra_number ?? 0));
  }, [sutras]);

  const milestones: Milestone[] = useMemo(() => {
    return ordered.map(sutra => {
      const done = completed.includes(sutra.id);
      const stepProgress = getStepProgress(sutra.id);
      const stepsDone = countSteps({
        read: stepProgress.read,
        listen: stepProgress.listen,
        learn: stepProgress.learn,
        learn_fill: stepProgress.learn_fill,
        recite: stepProgress.recite,
      });
      const fullyDone = done || stepsDone >= TOTAL_STEPS;
      return { sutra, stepsDone, fullyDone };
    });
  }, [ordered, completed, getStepProgress]);

  const catalogIds = useMemo(() => ordered.map(s => s.id), [ordered]);
  const hasMasterBadge = hasEarnedMasterBadge(catalogIds, completed);
  const completedCount = milestones.filter(m => m.fullyDone).length;
  const progressPct = ordered.length ? (completedCount / ordered.length) * 100 : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a0522d" />
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <>
      <View style={styles.titleRow}>
        <AppLogo size={48} />
        <Text style={styles.heading}>Jain Shala</Text>
      </View>
      {loadError ? (
        <Text style={styles.errorText}>
          Could not reach API at {API_URL}. From the project folder run: cd backend then uvicorn main:app --reload
          --host 0.0.0.0 --port 8000. Then reload the app.{'\n'}
          {loadError}
        </Text>
      ) : null}
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          Path: {completedCount} / {ordered.length} sutras completed
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>
      <Text style={styles.pathLabel}>Learning roadmap</Text>
      <Text style={styles.pathHint}>
        {ordered.length > 0
          ? `Stops follow sutra order 1–${ordered.length}. Progress (e.g. 2/5) is on each card — not on the circles.`
          : 'Tap a stop on the path to open that sutra.'}
      </Text>
      <TextInput
        style={styles.searchBar}
        placeholder="Search sutras…"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
      />
    </>
  );

  const listFooter =
    ordered.length === 0 ? null : (
      <View style={styles.footerWrap}>
        <View style={styles.finishRow}>
          <View style={styles.finishSideSpacer} />
          <View style={styles.spineColumn}>
            <View
              style={[
                styles.footerSpineBridge,
                {
                  backgroundColor:
                    milestones.length > 0 && milestones[milestones.length - 1].fullyDone
                      ? '#b8895e'
                      : '#c4bbb1',
                },
              ]}
            />
            <View
              style={[
                styles.finishNode,
                hasMasterBadge && styles.finishNodeEarned,
              ]}
            >
              <Text style={styles.finishNodeEmoji}>{MASTER_BADGE.emoji}</Text>
              {!hasMasterBadge ? (
                <View style={styles.finishLock}>
                  <Text style={styles.finishLockIcon}>🔒</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.finishSideSpacer} />
        </View>
        <TouchableOpacity
          style={[styles.finishCard, hasMasterBadge && styles.finishCardEarned]}
          onPress={() => router.push('/badges')}
          activeOpacity={0.9}
        >
          <Text style={styles.finishRibbon}>{MASTER_BADGE.ribbon}</Text>
          <Text style={styles.finishTitle}>{MASTER_BADGE.title}</Text>
          <Text style={styles.finishSub}>
            {hasMasterBadge
              ? MASTER_BADGE.subtitle
              : `Master all ${ordered.length} sutras on the path to unlock this jewel.`}
          </Text>
          <Text style={styles.finishCta}>{hasMasterBadge ? 'View badges →' : 'See progress →'}</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={milestones}
        keyExtractor={item => item.sutra.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        style={styles.listFill}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const { sutra, stepsDone, fullyDone } = item;
          const prevDone = index === 0 ? false : milestones[index - 1].fullyDone;
          const spineInactive = '#c4bbb1';
          const spineActive = '#b8895e';
          const upperColor =
            index === 0 ? 'transparent' : prevDone ? spineActive : spineInactive;
          const lowerColor = fullyDone ? spineActive : spineInactive;
          const cardOnRight = index % 2 === 0;

          const card = (
            <TouchableOpacity
              style={[styles.roadCard, fullyDone && styles.roadCardDone, styles.roadCardSpacing]}
              onPress={() => router.push(`/sutra/${sutra.id}`)}
              activeOpacity={0.88}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory} numberOfLines={1}>
                  {sutra.category}
                </Text>
                {fullyDone ? (
                  <Text style={styles.badge}>🏅 Done</Text>
                ) : stepsDone > 0 ? (
                  <Text style={[styles.badge, styles.badgePartial]}>
                    {stepsDone}/{TOTAL_STEPS}
                  </Text>
                ) : (
                  <Text style={[styles.badge, styles.badgeLocked]}>🔒 Start</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {sutra.title}
              </Text>
              {sutra.lines[0] ? (
                <>
                  <Text style={styles.cardFirstLine} numberOfLines={1}>
                    {sutra.lines[0].transliteration}
                  </Text>
                  <Text style={styles.cardTranslation} numberOfLines={2}>
                    {sutra.lines[0].translation_en}
                  </Text>
                </>
              ) : null}
              <View style={styles.tagsRow}>
                {sutra.tags.slice(0, 4).map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );

          return (
            <View style={styles.roadRow}>
              <View style={styles.roadSide}>
                {!cardOnRight ? card : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
              </View>

              <View style={styles.spineColumn}>
                <View
                  style={[
                    styles.spineFlexFill,
                    {
                      backgroundColor: upperColor === 'transparent' ? 'transparent' : upperColor,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.nodeOuter,
                    fullyDone && styles.nodeOuterDone,
                    !fullyDone && stepsDone > 0 && styles.nodeOuterProgress,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeStopNum,
                      fullyDone && styles.nodeStopNumDone,
                      !fullyDone && stepsDone > 0 && styles.nodeStopNumProgress,
                      !fullyDone && stepsDone === 0 && styles.nodeStopNumLocked,
                    ]}
                  >
                    {sutra.sutra_number}
                  </Text>
                  {!fullyDone && stepsDone === 0 ? (
                    <View style={styles.nodeLockBadge}>
                      <Text style={styles.nodeLockBadgeIcon}>🔒</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.spineFlexFill, { backgroundColor: lowerColor }]} />
              </View>

              <View style={styles.roadSide}>
                {cardOnRight ? card : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf8f5' },
  listFill: { flex: 1, backgroundColor: '#faf8f5' },
  /** Only horizontal + bottom padding — top inset comes from SafeAreaView so we avoid a tall blank band */
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heading: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },

  progressBar: { marginBottom: 8 },
  progressText: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#ebe6e0', borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: '#a0522d', borderRadius: 4 },

  pathLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  pathHint: { fontSize: 12, color: '#888', marginBottom: 12 },

  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e8dfd6',
  },
  errorText: {
    fontSize: 14,
    color: '#b00020',
    marginBottom: 12,
    lineHeight: 20,
  },

  roadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 0,
  },
  roadSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  /** Keeps row height aligned when zigzag leaves one side empty */
  roadCardSpacer: { minHeight: 168 },
  spineColumn: {
    width: SPINE_W,
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'column',
    zIndex: 1,
  },
  /** Fills half of row above/below node so the road meets adjacent rows with no gap */
  spineFlexFill: {
    flex: 1,
    width: SPINE_TRACK_W,
    minHeight: 6,
    alignSelf: 'center',
  },
  footerSpineBridge: {
    width: SPINE_TRACK_W,
    height: FOOTER_SPINE_BRIDGE,
    alignSelf: 'center',
  },
  nodeOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f0eb',
    borderWidth: 3,
    borderColor: '#b8aea2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nodeOuterProgress: {
    borderColor: '#c9a227',
    backgroundColor: '#fffbf0',
  },
  nodeOuterDone: {
    borderColor: '#8d4a28',
    backgroundColor: '#a0522d',
  },
  nodeStopNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5c534a',
  },
  nodeStopNumDone: { color: '#fff' },
  nodeStopNumProgress: { color: '#8b6914' },
  nodeStopNumLocked: { color: '#b0a89e' },
  nodeLockBadge: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  nodeLockBadgeIcon: { fontSize: 9 },

  roadCardSpacing: {
    marginVertical: 8,
  },
  roadCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0d8cf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 168,
  },
  roadCardDone: {
    borderColor: '#c9a227',
    borderWidth: 1.5,
    backgroundColor: '#fffdfb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardCategory: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  badge: { fontSize: 11, color: '#a0522d', fontWeight: '700' },
  badgePartial: { color: '#888', fontWeight: '600' },
  badgeLocked: { fontSize: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    minHeight: 42,
    lineHeight: 21,
  },
  cardFirstLine: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 2,
    minHeight: 18,
  },
  cardTranslation: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    lineHeight: 17,
    minHeight: 34,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 26, alignItems: 'center' },
  tag: {
    backgroundColor: '#f0ebe3',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: '#a0522d', fontWeight: '600' },

  footerWrap: { marginTop: 0, marginBottom: 16 },
  finishRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  finishSideSpacer: { flex: 1 },
  finishNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f0eb',
    borderWidth: 3,
    borderColor: '#cfc7bc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  finishNodeEarned: {
    backgroundColor: '#fffbf4',
    borderColor: '#c9a227',
  },
  finishNodeEmoji: { fontSize: 22, opacity: 0.85 },
  finishLock: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  finishLockIcon: { fontSize: 10 },

  finishCard: {
    marginHorizontal: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dcd3c8',
  },
  finishCardEarned: {
    borderStyle: 'solid',
    borderColor: '#c9a227',
    backgroundColor: '#fffbf4',
  },
  finishRibbon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b6914',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  finishTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  finishSub: {
    fontSize: 13,
    color: '#5c4a2e',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 10,
  },
  finishCta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a0522d',
    textAlign: 'center',
  },
});
