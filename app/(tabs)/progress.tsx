import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { useProgress } from '../../hooks/use-progress';
import { API_URL } from '../../constants/api';
import { fetchJson } from '../../lib/fetch-json';
import { getSutraBadgeFlair } from '../../constants/sutra-badge';
import { MASTER_BADGE, hasEarnedMasterBadge } from '../../constants/master-badge';
import { AppLogo } from '@/components/app-logo';

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
  badgeEpithet?: string;
  badgeEmoji?: string;
};

type BadgeRow = { sutra: Sutra; unlocked: boolean };

export default function ProgressScreen() {
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isCompleted, completed } = useProgress();

  useFocusEffect(
    useCallback(() => {
      // Re-render when nav focus comes back since completed may have changed
    }, [completed]),
  );

  useEffect(() => {
    let cancelled = false;
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
          setSutras([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: BadgeRow[] = useMemo(() => {
    const sorted = [...sutras].sort((a, b) => {
      const ae = completed.includes(a.id);
      const be = completed.includes(b.id);
      if (ae !== be) return ae ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return sorted.map(sutra => ({
      sutra,
      unlocked: completed.includes(sutra.id),
    }));
  }, [sutras, completed]);

  const completedCount = sutras.filter(s => isCompleted(s.id)).length;
  const lockedCount = sutras.length - completedCount;
  const catalogIds = sutras.map(s => s.id);
  const hasMasterBadge = hasEarnedMasterBadge(catalogIds, completed);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.titleRow}>
          <AppLogo size={48} />
          <Text style={styles.heading}>Your Progress</Text>
        </View>

        {hasMasterBadge && sutras.length > 0 ? (
          <View style={styles.masterBanner}>
            <Text style={styles.masterBannerEmoji}>{MASTER_BADGE.emoji}</Text>
            <View style={styles.masterBannerTextCol}>
              <Text style={styles.masterBannerRibbon}>{MASTER_BADGE.ribbon}</Text>
              <Text style={styles.masterBannerTitle}>{MASTER_BADGE.title}</Text>
              <Text style={styles.masterBannerSub}>{MASTER_BADGE.subtitle}</Text>
            </View>
          </View>
        ) : null}

        {!hasMasterBadge && sutras.length > 0 ? (
          <View style={styles.masterTeaser}>
            <View style={styles.masterTeaserMedallion}>
              <Text style={styles.masterTeaserEmoji}>{MASTER_BADGE.emoji}</Text>
              <View style={styles.masterTeaserLock}>
                <Text style={styles.masterTeaserLockIcon}>🔒</Text>
              </View>
            </View>
            <View style={styles.masterTeaserTextCol}>
              <Text style={styles.masterTeaserName}>{MASTER_BADGE.title}</Text>
              <Text style={styles.masterTeaserHint}>
                Master every sutra in the list below to unlock this main badge.
              </Text>
            </View>
          </View>
        ) : null}

        <Link href="/badges" asChild>
          <Pressable
            style={({ pressed }) => [styles.statsCard, pressed && styles.statsCardPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open full badge gallery"
          >
            <View style={styles.statsTopRow}>
              <Text style={styles.statsEmoji}>🏅</Text>
              <View style={styles.statsNumberCol}>
                <Text style={styles.statsBigNumber}>{completedCount}</Text>
                <Text style={styles.statsSubtitle}>Badges earned</Text>
              </View>
            </View>
            <Text style={styles.statsDetail}>
              {completedCount} of {sutras.length} sutras fully mastered
            </Text>
            <Text style={styles.statsTapHint}>Open gallery · all names & locked previews →</Text>
          </Pressable>
        </Link>

        <Text style={styles.sectionTitle}>Sutra badges</Text>
        <Text style={styles.sectionMeta}>
          {completedCount} earned{lockedCount > 0 ? ` · ${lockedCount} locked` : ''}
        </Text>
      </>
    ),
    [
      hasMasterBadge,
      sutras.length,
      completedCount,
      lockedCount,
    ],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={item => item.sutra.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const { sutra, unlocked } = item;
          const flair = getSutraBadgeFlair(sutra.id, sutra);
          return (
            <TouchableOpacity
              style={[styles.badgeRow, !unlocked && styles.badgeRowLocked]}
              activeOpacity={0.88}
              onPress={() => router.push(`/sutra/${sutra.id}` as any)}
            >
              <View style={styles.medallionWrap}>
                <Text style={[styles.rowEmoji, !unlocked && styles.rowEmojiLocked]}>{flair.emoji}</Text>
                {!unlocked && (
                  <View style={styles.lockCornerBadge}>
                    <Text style={styles.lockCornerIcon}>🔒</Text>
                  </View>
                )}
              </View>
              <View style={styles.rowTextCol}>
                <View style={styles.rowTopLabels}>
                  <Text style={[styles.rowCategory, !unlocked && styles.rowCategoryLocked]} numberOfLines={1}>
                    {sutra.category}
                  </Text>
                  {unlocked ? (
                    <View style={styles.earnedPill}>
                      <Text style={styles.earnedPillText}>Earned</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedPill}>
                      <Text style={styles.lockedPillText}>Locked</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowEpithet, !unlocked && styles.rowEpithetLocked]} numberOfLines={2}>
                  {flair.epithet}
                </Text>
                <Text style={[styles.rowTitle, !unlocked && styles.rowTitleLocked]} numberOfLines={2}>
                  {sutra.title}
                </Text>
                {sutra.lines[0]?.transliteration ? (
                  <Text
                    style={[styles.rowFirstLine, !unlocked && styles.rowFirstLineLocked]}
                    numberOfLines={1}
                  >
                    {sutra.lines[0].transliteration}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.rowChevron}>→</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          sutras.length === 0 ? (
            <Text style={styles.emptyList}>No sutras loaded. Check the API and pull to try again.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  heading: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },

  masterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fffbf4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#c9a227',
  },
  masterBannerEmoji: { fontSize: 44 },
  masterBannerTextCol: { flex: 1 },
  masterBannerRibbon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b6914',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  masterBannerTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  masterBannerSub: { fontSize: 13, color: '#5c4a2e', lineHeight: 18 },

  masterTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f8f6f3',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5ded4',
    borderStyle: 'dashed',
  },
  masterTeaserMedallion: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterTeaserEmoji: { fontSize: 38, opacity: 0.4 },
  masterTeaserLock: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
  },
  masterTeaserLockIcon: { fontSize: 12, marginTop: 1 },
  masterTeaserTextCol: { flex: 1 },
  masterTeaserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#666',
    marginBottom: 4,
  },
  masterTeaserHint: { fontSize: 13, color: '#888', lineHeight: 18 },

  statsCard: {
    backgroundColor: '#fdf8f4',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d7cbbf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statsCardPressed: { opacity: 0.92 },
  statsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  statsEmoji: { fontSize: 44 },
  statsNumberCol: { flex: 1 },
  statsBigNumber: { fontSize: 40, fontWeight: '800', color: '#a0522d', lineHeight: 44 },
  statsSubtitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
  statsDetail: { fontSize: 14, color: '#666', marginBottom: 8 },
  statsTapHint: { fontSize: 12, color: '#a0522d', fontWeight: '700' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sectionMeta: { fontSize: 13, color: '#888', marginBottom: 14 },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    gap: 12,
  },
  badgeRowLocked: {
    backgroundColor: '#fafafa',
    borderColor: '#ececec',
  },
  medallionWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmoji: { fontSize: 36 },
  rowEmojiLocked: { opacity: 0.38 },
  lockCornerBadge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockCornerIcon: { fontSize: 12, marginTop: 1 },
  rowTextCol: { flex: 1 },
  rowTopLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  rowCategory: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  rowCategoryLocked: { color: '#b5a091' },
  earnedPill: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  earnedPillText: { fontSize: 10, fontWeight: '800', color: '#2e7d32' },
  lockedPill: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lockedPillText: { fontSize: 10, fontWeight: '800', color: '#888' },
  rowEpithet: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  rowEpithetLocked: { color: '#6d6d6d' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 3 },
  rowTitleLocked: { color: '#555' },
  rowFirstLine: { fontSize: 12, color: '#777', fontStyle: 'italic' },
  rowFirstLineLocked: { color: '#aaa' },
  rowChevron: { fontSize: 16, color: '#d0c8c0', fontWeight: '700', alignSelf: 'center' },

  emptyList: { fontSize: 14, color: '#888', textAlign: 'center', paddingVertical: 24 },
});
