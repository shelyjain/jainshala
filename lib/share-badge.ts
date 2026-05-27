import { Alert, Linking, Platform, Share } from 'react-native';
import { MASTER_BADGE } from '../constants/master-badge';

export type ShareBadgePayload = {
  emoji: string;
  epithet?: string;
  sutraTitle?: string;
  earnedCount?: number;
  totalCount?: number;
  isMaster?: boolean;
};

export function buildBadgeShareMessage(payload: ShareBadgePayload): string {
  if (payload.isMaster) {
    return `${MASTER_BADGE.emoji} I earned "${MASTER_BADGE.title}" on Jain Shala — every sutra on the path mastered! 🙏`;
  }
  if (payload.epithet && payload.sutraTitle) {
    return `${payload.emoji} I earned the "${payload.epithet}" badge for ${payload.sutraTitle} on Jain Shala! 🙏`;
  }
  const earned = payload.earnedCount ?? 0;
  const total = payload.totalCount ?? 0;
  return `🏅 I've earned ${earned} of ${total} sutra badges on Jain Shala! Join me on the learning path. 🙏`;
}

async function openUrl(url: string, appLabel: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(
        `${appLabel} unavailable`,
        `Install ${appLabel} or use the generic share button instead.`
      );
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open', `Unable to open ${appLabel} right now.`);
  }
}

export async function shareBadgeNative(message: string) {
  try {
    await Share.share(
      Platform.OS === 'ios' ? { message } : { message, title: 'Jain Shala' }
    );
  } catch {
    /* user dismissed */
  }
}

export async function shareBadgeToWhatsApp(message: string) {
  await openUrl(`whatsapp://send?text=${encodeURIComponent(message)}`, 'WhatsApp');
}

export async function shareBadgeToX(message: string) {
  await openUrl(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
    'X'
  );
}

export async function shareBadgeToFacebook(message: string) {
  await openUrl(
    `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(message)}`,
    'Facebook'
  );
}

export async function shareBadgeToTelegram(message: string) {
  await openUrl(
    `https://t.me/share/url?text=${encodeURIComponent(message)}`,
    'Telegram'
  );
}
