import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

type UserAvatarProps = {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
};

export function UserAvatar({ photoURL, displayName, email, size = 72 }: UserAvatarProps) {
  const initial = (displayName || email || 'U')[0].toUpperCase();

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        accessibilityLabel="Profile photo"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: '#e8dfd6',
  },
  fallback: {
    backgroundColor: '#a0522d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: '700',
  },
});
