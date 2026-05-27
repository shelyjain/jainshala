import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  buildBadgeShareMessage,
  shareBadgeNative,
  shareBadgeToFacebook,
  shareBadgeToTelegram,
  shareBadgeToWhatsApp,
  shareBadgeToX,
  type ShareBadgePayload,
} from '@/lib/share-badge';

type SocialId = 'share' | 'whatsapp' | 'x' | 'facebook' | 'telegram';

const BUTTONS: {
  id: SocialId;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  accessibilityLabel: string;
}[] = [
  {
    id: 'share',
    icon: 'share-social-outline',
    color: '#a0522d',
    bg: '#fdf0e8',
    accessibilityLabel: 'Share',
  },
  {
    id: 'whatsapp',
    icon: 'logo-whatsapp',
    color: '#fff',
    bg: '#25D366',
    accessibilityLabel: 'Share on WhatsApp',
  },
  {
    id: 'x',
    icon: 'logo-twitter',
    color: '#fff',
    bg: '#0f1419',
    accessibilityLabel: 'Share on X',
  },
  {
    id: 'facebook',
    icon: 'logo-facebook',
    color: '#fff',
    bg: '#1877F2',
    accessibilityLabel: 'Share on Facebook',
  },
  {
    id: 'telegram',
    icon: 'paper-plane',
    color: '#fff',
    bg: '#229ED9',
    accessibilityLabel: 'Share on Telegram',
  },
];

type Props = {
  payload: ShareBadgePayload;
  compact?: boolean;
};

export function BadgeShareBar({ payload, compact = false }: Props) {
  const [busyId, setBusyId] = useState<SocialId | null>(null);
  const size = compact ? 34 : 38;
  const iconSize = compact ? 18 : 20;

  const runShare = async (id: SocialId) => {
    const message = buildBadgeShareMessage(payload);
    setBusyId(id);
    try {
      switch (id) {
        case 'share':
          await shareBadgeNative(message);
          break;
        case 'whatsapp':
          await shareBadgeToWhatsApp(message);
          break;
        case 'x':
          await shareBadgeToX(message);
          break;
        case 'facebook':
          await shareBadgeToFacebook(message);
          break;
        case 'telegram':
          await shareBadgeToTelegram(message);
          break;
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {BUTTONS.map(btn => {
        const loading = busyId === btn.id;
        return (
          <TouchableOpacity
            key={btn.id}
            style={[
              styles.iconBtn,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: btn.bg },
            ]}
            onPress={() => runShare(btn.id)}
            disabled={busyId !== null}
            accessibilityLabel={btn.accessibilityLabel}
            accessibilityRole="button"
            activeOpacity={0.75}
          >
            {loading ? (
              <ActivityIndicator size="small" color={btn.color} />
            ) : (
              <Ionicons name={btn.icon} size={iconSize} color={btn.color} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  rowCompact: {
    gap: 8,
    marginTop: 8,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
