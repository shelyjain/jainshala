import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppLogo } from './app-logo';
import { setAdminPortalUnlocked } from '../lib/admin-unlock';

type AdminLogoTapProps = {
  size?: number;
  onUnlocked?: () => void;
};

export function AdminLogoTap({ size = 96, onUnlocked }: AdminLogoTapProps) {
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const handlePress = () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapCount.current += 1;

    if (tapCount.current >= 3) {
      tapCount.current = 0;
      void setAdminPortalUnlocked(true).then(() => {
        setUnlocked(true);
        onUnlocked?.();
      });
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 600);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={handlePress} accessibilityLabel="Jain Shala logo">
        <AppLogo size={size} />
      </Pressable>
      {unlocked ? <Text style={styles.hint}>Admin portal unlocked</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#a0522d',
    fontWeight: '600',
  },
});
