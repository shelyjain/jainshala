import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';

const SOURCE = require('@/assets/images/jain-shala-logo.png');

type AppLogoProps = {
  /** Width and height in dp (square asset scales with contain). */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ size = 112, style }: AppLogoProps) {
  return (
    <Image
      source={SOURCE}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Jain Shala logo"
    />
  );
}
