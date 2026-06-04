import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../constants/api';
import { useProgress } from '../../hooks/use-progress';
import { getSutraBadgeFlair } from '../../constants/sutra-badge';
import { MASTER_BADGE, hasEarnedMasterBadgeWithPending } from '../../constants/master-badge';
import { fetchJson } from '../../lib/fetch-json';

export default function Complete() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [catalogIds, setCatalogIds] = useState<string[]>([]);
  const { markComplete, completed } = useProgress();
  const [badgeOverride, setBadgeOverride] = useState<{ badgeEpithet?: string; badgeEmoji?: string }>();
  const flair = getSutraBadgeFlair(String(id ?? ''), badgeOverride);

  useEffect(() => {
    fetch(`${API_URL}/sutra/${id}`)
      .then(res => res.json())
      .then(data => {
        setTitle(data.title);
        setBadgeOverride({
          badgeEpithet: data.badgeEpithet,
          badgeEmoji: data.badgeEmoji,
        });
      });

    if (id) {
      markComplete(String(id));
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ id: string }[]>(`${API_URL}/sutras`)
      .then(list => {
        if (!cancelled) setCatalogIds(Array.isArray(list) ? list.map(s => s.id) : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const earnedMasterBadge = useMemo(
    () => hasEarnedMasterBadgeWithPending(catalogIds, completed, String(id ?? '')),
    [catalogIds, completed, id],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{flair.emoji}</Text>
      <Text style={styles.heading}>Badge earned</Text>
      <Text style={styles.badgeName}>{flair.epithet}</Text>
      <Text style={styles.subtitle}>{title}</Text>
      <Text style={styles.body}>
        You've practiced the meaning quiz, fill-in-the-blanks, and sequence order for this sutra. Find it anytime under
        Progress — tap your badge count to see all names.
      </Text>

      {earnedMasterBadge ? (
        <View style={styles.masterCard}>
          <Text style={styles.masterCardEmoji}>{MASTER_BADGE.emoji}</Text>
          <Text style={styles.masterCardRibbon}>{MASTER_BADGE.ribbon}</Text>
          <Text style={styles.masterCardTitle}>{MASTER_BADGE.title}</Text>
          <Text style={styles.masterCardSub}>{MASTER_BADGE.subtitle}</Text>
        </View>
      ) : null}

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
  emoji: { fontSize: 80, marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '600', color: '#666', marginBottom: 6 },
  badgeName: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center', paddingHorizontal: 8 },
  subtitle: { fontSize: 16, color: '#a0522d', fontWeight: '600', marginBottom: 14, textAlign: 'center' },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  masterCard: {
    alignItems: 'center',
    backgroundColor: '#fffbf4',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#c9a227',
    width: '100%',
    maxWidth: 400,
  },
  masterCardEmoji: { fontSize: 44, marginBottom: 8 },
  masterCardRibbon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b6914',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  masterCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  masterCardSub: {
    fontSize: 13,
    color: '#5c4a2e',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  btn: { backgroundColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', width: '100%', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: { borderWidth: 1.5, borderColor: '#a0522d', borderRadius: 12, padding: 18, alignItems: 'center', width: '100%' },
  btnOutlineText: { color: '#a0522d', fontSize: 16, fontWeight: '600' },
});