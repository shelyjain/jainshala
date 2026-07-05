import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';
import { useUserProfile } from '../../hooks/use-user-profile';
import { isAdminPortalUnlocked } from '../../lib/admin-unlock';
import { useProgress } from '../../hooks/use-progress';
import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../constants/api';
import { fetchJson } from '../../lib/fetch-json';
import { getSutraBadgeFlair } from '../../constants/sutra-badge';
import { MASTER_BADGE, hasEarnedMasterBadge } from '../../constants/master-badge';
import { AppLogo } from '@/components/app-logo';
import { BadgeAboutModal, type BadgeAboutSelection } from '@/components/badge-about-modal';
import { UserAvatar } from '@/components/user-avatar';

type SutraListItem = {
  id: string;
  title: string;
  category: string;
  badgeEpithet?: string;
  badgeEmoji?: string;
};

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserProfile();
  const { completed } = useProgress();
  const [sutras, setSutras] = useState<SutraListItem[]>([]);
  const [sutrasLoading, setSutrasLoading] = useState(true);
  const [badgeAbout, setBadgeAbout] = useState<BadgeAboutSelection | null>(null);
  const [adminPortalOpen, setAdminPortalOpen] = useState(false);

  useEffect(() => {
    void isAdminPortalUnlocked().then(setAdminPortalOpen);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJson<SutraListItem[]>(`${API_URL}/sutras`)
      .then(data => {
        if (!cancelled) setSutras(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSutras([]);
      })
      .finally(() => {
        if (!cancelled) setSutrasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogIds = useMemo(() => sutras.map(s => s.id), [sutras]);
  const hasMasterBadge = hasEarnedMasterBadge(catalogIds, completed);

  const badgeStripRows = useMemo(() => {
    const sorted = [...sutras].sort((a, b) => {
      const ae = completed.includes(a.id);
      const be = completed.includes(b.id);
      if (ae !== be) return ae ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return sorted.map(sutra => ({
      sutra,
      unlocked: completed.includes(sutra.id),
      flair: getSutraBadgeFlair(sutra.id, sutra),
    }));
  }, [sutras, completed]);

  const performSignOut = async () => {
    try {
      await signOut();
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Could not sign out. Please try again.');
      } else {
        Alert.alert('Error', 'Could not sign out. Please try again.');
      }
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        void performSignOut();
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  };

  const nEarned = sutras.filter(s => completed.includes(s.id)).length;
  const total = sutras.length;
  const lockedCount = total - nEarned;

  const masteredLabel =
    total === 0
      ? 'Loading sutras…'
      : `${nEarned} of ${total} earned${lockedCount > 0 ? ` · ${lockedCount} locked` : ''}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <View style={styles.titleRow}>
        <AppLogo size={44} />
        <Text style={styles.heading}>Account</Text>
      </View>

      <View style={styles.profileCard}>
        <UserAvatar
          photoURL={user?.photoURL}
          displayName={user?.displayName}
          email={user?.email}
          size={72}
        />
        <Text style={styles.name}>{user?.displayName || 'Learner'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {!sutrasLoading && hasMasterBadge && sutras.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.masterBanner, pressed && styles.masterBannerPressed]}
          onPress={() =>
            setBadgeAbout({
              kind: 'master',
              unlocked: true,
              earnedCount: nEarned,
              totalCount: total,
            })
          }
        >
          <Text style={styles.masterBannerEmoji}>{MASTER_BADGE.emoji}</Text>
          <View style={styles.masterBannerTextCol}>
            <Text style={styles.masterBannerRibbon}>{MASTER_BADGE.ribbon}</Text>
            <Text style={styles.masterBannerTitle}>{MASTER_BADGE.title}</Text>
            <Text style={styles.masterBannerSub}>{MASTER_BADGE.subtitle}</Text>
          </View>
        </Pressable>
      ) : null}

      {!sutrasLoading && !hasMasterBadge && sutras.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.masterTeaser, pressed && styles.masterTeaserPressed]}
          onPress={() =>
            setBadgeAbout({
              kind: 'master',
              unlocked: false,
              earnedCount: nEarned,
              totalCount: total,
            })
          }
        >
          <View style={styles.masterTeaserMedallion}>
            <Text style={styles.masterTeaserEmoji}>{MASTER_BADGE.emoji}</Text>
            <View style={styles.masterTeaserLock}>
              <Text style={styles.masterTeaserLockIcon}>🔒</Text>
            </View>
          </View>
          <View style={styles.masterTeaserTextCol}>
            <Text style={styles.masterTeaserName}>{MASTER_BADGE.title}</Text>
            <Text style={styles.masterTeaserHint}>Earn every sutra badge below to unlock.</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.badgeSection}>
        <View style={styles.badgeSectionTitleRow}>
          <View style={styles.badgeSectionTitleCol}>
            <Text style={styles.badgeSectionTitle}>Badge collection</Text>
            <Text style={styles.badgeSectionMeta}>{masteredLabel}</Text>
          </View>
          <View style={[styles.countPill, nEarned === 0 && styles.countPillMuted]}>
            <Text style={[styles.countPillText, nEarned === 0 && styles.countPillTextMuted]}>{nEarned}</Text>
          </View>
        </View>

        {sutrasLoading ? (
          <View style={styles.badgeLoadingRow}>
            <ActivityIndicator color="#a0522d" />
            <Text style={styles.badgeLoadingText}>Loading badges…</Text>
          </View>
        ) : sutras.length === 0 ? (
          <View style={styles.badgeEmptyPreview}>
            <Text style={styles.badgeEmptyEmoji}>📭</Text>
            <Text style={styles.badgeEmptyCopy}>Could not load sutras. Check the API and try again.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeChipScrollContent}
            style={styles.badgeChipScroll}
            nestedScrollEnabled
          >
            {badgeStripRows.map(({ sutra, unlocked, flair }) => (
              <Pressable
                key={sutra.id}
                style={({ pressed }) => [
                  styles.badgeChip,
                  !unlocked && styles.badgeChipLocked,
                  pressed && styles.badgeChipPressed,
                ]}
                onPress={() =>
                  setBadgeAbout({
                    kind: 'sutra',
                    sutraId: sutra.id,
                    epithet: flair.epithet,
                    emoji: flair.emoji,
                    sutraTitle: sutra.title,
                    category: sutra.category,
                    unlocked,
                  })
                }
              >
                <View style={styles.chipTopRow}>
                  <View style={styles.medallionWrap}>
                    <Text style={[styles.chipEmoji, !unlocked && styles.chipEmojiLocked]}>{flair.emoji}</Text>
                    {!unlocked ? (
                      <View style={styles.lockCornerBadge}>
                        <Text style={styles.lockCornerIcon}>🔒</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.statusMini, unlocked ? styles.statusMiniEarned : styles.statusMiniLocked]}>
                    <Text style={[styles.statusMiniText, unlocked ? styles.statusMiniTextEarned : styles.statusMiniTextLocked]}>
                      {unlocked ? 'Earned' : 'Locked'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.badgeChipEpithet, !unlocked && styles.badgeChipEpithetLocked]} numberOfLines={2}>
                  {flair.epithet}
                </Text>
                <Text style={[styles.badgeChipTitle, !unlocked && styles.badgeChipTitleLocked]} numberOfLines={3}>
                  {sutra.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.badgeCtaWrap}>
          <Link href="/badges" asChild>
            <Pressable
              style={({ pressed }) => [styles.badgeCtaButton, pressed && styles.badgeCtaButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open full badge gallery"
            >
              <View style={styles.badgeCtaRow}>
                <Text style={styles.badgeCtaText}>Full badge gallery</Text>
                <Text style={styles.badgeCtaChevron}>→</Text>
              </View>
            </Pressable>
          </Link>
        </View>
      </View>

      {adminPortalOpen && isAdmin ? (
        <Link href="/admin" asChild>
          <TouchableOpacity style={styles.adminBtn} activeOpacity={0.88}>
            <Text style={styles.adminBtnText}>Admin portal</Text>
          </TouchableOpacity>
        </Link>
      ) : null}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <BadgeAboutModal
        visible={badgeAbout !== null}
        selection={badgeAbout}
        onClose={() => setBadgeAbout(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 56 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  heading: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fdf8f4',
    borderRadius: 16,
    padding: 28,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e8d5c4',
    gap: 14,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#888' },

  masterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fffbf4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#c9a227',
  },
  masterBannerPressed: { opacity: 0.92 },
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e5ded4',
  },
  masterTeaserPressed: { opacity: 0.92 },
  masterTeaserMedallion: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterTeaserEmoji: { fontSize: 34, opacity: 0.4 },
  masterTeaserLock: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
  },
  masterTeaserLockIcon: { fontSize: 11, marginTop: 1 },
  masterTeaserTextCol: { flex: 1 },
  masterTeaserName: { fontSize: 15, fontWeight: '800', color: '#666', marginBottom: 4 },
  masterTeaserHint: { fontSize: 13, color: '#888', lineHeight: 18 },

  badgeSection: {
    backgroundColor: '#fdf8f4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7cbbf',
    marginBottom: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  badgeSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8dfd6',
  },
  badgeSectionTitleCol: { flex: 1 },
  badgeSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  badgeSectionMeta: { fontSize: 13, color: '#666', lineHeight: 18 },
  countPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a0522d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  countPillMuted: { backgroundColor: '#e8dfd6' },
  countPillText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  countPillTextMuted: { color: '#888' },

  badgeLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  badgeLoadingText: { fontSize: 13, color: '#666' },

  badgeEmptyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#fffaf6',
  },
  badgeEmptyEmoji: { fontSize: 36 },
  badgeEmptyCopy: { flex: 1, fontSize: 13, color: '#555', lineHeight: 19 },

  badgeChipScroll: { flexGrow: 0 },
  badgeChipScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'stretch',
  },
  badgeChip: {
    width: 156,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8d5c4',
    marginRight: 10,
  },
  badgeChipLocked: {
    backgroundColor: '#fafafa',
    borderColor: '#e8e8e8',
  },
  badgeChipPressed: { opacity: 0.92 },
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  medallionWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipEmoji: { fontSize: 30 },
  chipEmojiLocked: { opacity: 0.38 },
  lockCornerBadge: {
    position: 'absolute',
    right: -8,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  lockCornerIcon: { fontSize: 10, marginTop: 1 },
  statusMini: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusMiniEarned: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  statusMiniLocked: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusMiniText: { fontSize: 9, fontWeight: '800' },
  statusMiniTextEarned: { color: '#2e7d32' },
  statusMiniTextLocked: { color: '#888' },

  badgeChipEpithet: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 18,
    marginBottom: 6,
  },
  badgeChipEpithetLocked: { color: '#6d6d6d' },
  badgeChipTitle: { fontSize: 11, color: '#666', lineHeight: 15 },
  badgeChipTitleLocked: { color: '#888' },

  badgeCtaWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8dfd6',
  },
  badgeCtaButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#a0522d',
    backgroundColor: '#fffaf6',
    overflow: 'hidden',
  },
  badgeCtaButtonPressed: {
    backgroundColor: '#f5ebe3',
    opacity: 0.96,
  },
  badgeCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
  },
  badgeCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a0522d',
    flexShrink: 1,
  },
  badgeCtaChevron: {
    fontSize: 17,
    fontWeight: '700',
    color: '#a0522d',
    flexShrink: 0,
    marginTop: 1,
  },

  adminLinkWrap: { alignItems: 'center', marginBottom: 16 },
  adminLink: {
    color: '#a0522d',
    fontWeight: '700',
    fontSize: 15,
  },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: '#cc3333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#cc3333', fontSize: 16, fontWeight: '600' },
  adminBtn: {
    borderWidth: 1.5,
    borderColor: '#a0522d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fffaf6',
  },
  adminBtnText: { color: '#a0522d', fontSize: 16, fontWeight: '700' },
});
