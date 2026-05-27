import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeShareBar } from '@/components/badge-share-bar';
import { getMasterBadgeAbout, getSutraBadgeAbout } from '@/lib/badge-about';
import { MASTER_BADGE } from '@/constants/master-badge';

export type BadgeAboutSelection =
  | {
      kind: 'sutra';
      sutraId: string;
      epithet: string;
      emoji: string;
      sutraTitle: string;
      category: string;
      unlocked: boolean;
    }
  | {
      kind: 'master';
      unlocked: boolean;
      earnedCount: number;
      totalCount: number;
    };

type Props = {
  visible: boolean;
  selection: BadgeAboutSelection | null;
  onClose: () => void;
};

export function BadgeAboutModal({ visible, selection, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!selection) return null;

  const isMaster = selection.kind === 'master';
  const unlocked = selection.unlocked;
  const emoji = isMaster ? MASTER_BADGE.emoji : selection.emoji;
  const title = isMaster ? MASTER_BADGE.title : selection.epithet;
  const subtitle = isMaster ? MASTER_BADGE.subtitle : selection.sutraTitle;
  const category = isMaster ? MASTER_BADGE.ribbon : selection.category;
  const about = isMaster ? getMasterBadgeAbout(unlocked) : getSutraBadgeAbout(unlocked);

  const openSutra = () => {
    if (selection.kind !== 'sutra') return;
    onClose();
    router.push(`/sutra/${selection.sutraId}` as any);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.hero}>
              <Text style={[styles.heroEmoji, !unlocked && styles.heroEmojiLocked]}>{emoji}</Text>
              {!unlocked && !isMaster ? (
                <View style={styles.lockBadge}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.statusPill, unlocked ? styles.statusEarned : styles.statusLocked]}>
              <Text style={[styles.statusText, unlocked ? styles.statusTextEarned : styles.statusTextLocked]}>
                {unlocked ? 'Earned' : 'Locked'}
              </Text>
            </View>

            <Text style={styles.aboutHeading}>About this badge</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Text style={styles.category}>{category}</Text>

            <Text style={styles.aboutBody}>{about}</Text>

            {unlocked ? (
              <View style={styles.shareSection}>
                <Text style={styles.shareLabel}>Share</Text>
                <BadgeShareBar
                  payload={
                    isMaster
                      ? {
                          emoji: MASTER_BADGE.emoji,
                          isMaster: true,
                          earnedCount: selection.earnedCount,
                          totalCount: selection.totalCount,
                        }
                      : {
                          emoji: selection.emoji,
                          epithet: selection.epithet,
                          sutraTitle: selection.sutraTitle,
                        }
                  }
                />
              </View>
            ) : (
              <Text style={styles.lockedShareHint}>Earn this badge to unlock sharing.</Text>
            )}

            {selection.kind === 'sutra' ? (
              <TouchableOpacity style={styles.sutraBtn} onPress={openSutra} activeOpacity={0.88}>
                <Text style={styles.sutraBtnText}>
                  {unlocked ? 'Review sutra' : 'Start learning this sutra'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.88}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 16,
  },
  hero: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmoji: { fontSize: 56 },
  heroEmojiLocked: { opacity: 0.4 },
  lockBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4d4d4',
  },
  lockIcon: { fontSize: 14 },
  statusPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusEarned: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  statusLocked: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0' },
  statusText: { fontSize: 12, fontWeight: '800' },
  statusTextEarned: { color: '#2e7d32' },
  statusTextLocked: { color: '#888' },
  aboutHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'center',
    marginBottom: 16,
  },
  aboutBody: {
    fontSize: 15,
    color: '#444',
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  shareSection: { marginBottom: 8 },
  shareLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  lockedShareHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  sutraBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sutraBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
  },
  closeBtnText: { fontSize: 16, fontWeight: '600', color: '#888' },
});
