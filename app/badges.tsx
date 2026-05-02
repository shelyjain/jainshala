import { StyleSheet, Text, View, ActivityIndicator, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProgress } from '../hooks/use-progress';
import { API_URL } from '../constants/api';
import { fetchJson } from '../lib/fetch-json';
import { getSutraBadgeFlair } from '../constants/sutra-badge';
import { MASTER_BADGE, hasEarnedMasterBadge } from '../constants/master-badge';

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
};

type BadgeRow = {
  sutra: Sutra;
  unlocked: boolean;
};

export default function BadgesModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completed } = useProgress();
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<Sutra[]>(`${API_URL}/sutras`)
      .then(data => {
        if (!cancelled) {
          setSutras(data);
          setLoading(false);
        }
      })
      .catch(() => {
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

  const earnedCount = rows.filter(r => r.unlocked).length;
  const catalogIds = useMemo(() => sutras.map(s => s.id), [sutras]);
  const hasMasterBadge = hasEarnedMasterBadge(catalogIds, completed);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#a0522d" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>Done</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Badges</Text>
      <Text style={styles.countLine}>
        {hasMasterBadge ? `${MASTER_BADGE.ribbon} unlocked · ` : ''}
        {earnedCount} of {sutras.length} sutra badges earned
      </Text>

      {sutras.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No sutras loaded</Text>
          <Text style={styles.emptyBody}>Check that the API is running, then try again.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.sutra.id}
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              {hasMasterBadge ? (
                <View style={styles.masterHero}>
                  <View style={styles.masterRibbon}>
                    <Text style={styles.masterRibbonText}>{MASTER_BADGE.ribbon}</Text>
                  </View>
                  <Text style={styles.masterEmoji}>{MASTER_BADGE.emoji}</Text>
                  <Text style={styles.masterTitle}>{MASTER_BADGE.title}</Text>
                  <Text style={styles.masterSubtitle}>{MASTER_BADGE.subtitle}</Text>
                </View>
              ) : null}
              <Text style={styles.lead}>
                Each sutra has a named badge. Locked rows show the icon dimmed with a lock until you finish all steps.
              </Text>
            </View>
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => {
            const { sutra, unlocked } = item;
            const { epithet, emoji } = getSutraBadgeFlair(sutra.id);
            return (
              <TouchableOpacity
                style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
                activeOpacity={0.85}
                onPress={() => router.push(`/sutra/${sutra.id}` as any)}
              >
                <View style={styles.medallionWrap}>
                  <Text style={[styles.badgeEmoji, !unlocked && styles.badgeEmojiBehindLock]}>{emoji}</Text>
                  {!unlocked && (
                    <View style={styles.lockCornerBadge}>
                      <Text style={styles.lockCornerIcon}>🔒</Text>
                    </View>
                  )}
                </View>
                <View style={styles.badgeTextCol}>
                  <Text style={[styles.epithet, !unlocked && styles.epithetLocked]}>{epithet}</Text>
                  <Text style={[styles.sutraTitle, !unlocked && styles.sutraTitleLocked]}>{sutra.title}</Text>
                  {!unlocked && (
                    <Text style={styles.unlockHint}>Complete read, listen, learn, fill-in & recite to earn</Text>
                  )}
                  <Text style={[styles.category, !unlocked && styles.categoryLocked]}>{sutra.category}</Text>
                </View>
                <Text style={styles.rowChevron}>→</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  close: {
    fontSize: 17,
    fontWeight: '600',
    color: '#a0522d',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  countLine: { fontSize: 14, color: '#888', marginBottom: 12 },
  listHeaderWrap: { marginBottom: 8 },
  masterHero: {
    alignItems: 'center',
    backgroundColor: '#fffbf4',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#c9a227',
    shadowColor: '#c9a227',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  masterRibbon: {
    backgroundColor: '#1a1408',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  masterRibbonText: {
    color: '#f5e6b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  masterEmoji: { fontSize: 52, marginBottom: 10 },
  masterTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  masterSubtitle: {
    fontSize: 14,
    color: '#5c4a2e',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  lead: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
    marginBottom: 14,
  },
  listContent: { paddingTop: 4 },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf8f4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8d5c4',
    gap: 14,
  },
  badgeCardLocked: {
    backgroundColor: '#f4f4f4',
    borderColor: '#e8e8e8',
  },
  medallionWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 40 },
  /** Dimmed badge glyph behind the lock overlay */
  badgeEmojiBehindLock: {
    opacity: 0.38,
  },
  lockCornerBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  lockCornerIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  badgeTextCol: { flex: 1 },
  epithet: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  epithetLocked: {
    color: '#6d6d6d',
  },
  sutraTitle: { fontSize: 14, color: '#555', fontWeight: '500', marginBottom: 4 },
  sutraTitleLocked: { color: '#666' },
  unlockHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    lineHeight: 17,
  },
  category: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  categoryLocked: {
    color: '#b5a091',
  },
  rowChevron: {
    fontSize: 17,
    color: '#d0c8c0',
    fontWeight: '600',
    alignSelf: 'center',
    paddingLeft: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  emptyBody: { fontSize: 15, color: '#777', textAlign: 'center', lineHeight: 22 },
});
