import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/auth';
import { isAdminPortalUnlocked } from '@/lib/admin-unlock';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGuard() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = pathname.startsWith('/auth');
    const inOnboarding = pathname.startsWith('/onboarding');
    const inAdmin = pathname.startsWith('/admin');

    if (!user) {
      if (!inAuthGroup && !inAdmin) {
        router.replace('/auth/login');
      }
      return;
    }

    // User is logged in
    if (inAuthGroup) {
      Promise.all([AsyncStorage.getItem('onboarding_complete'), isAdminPortalUnlocked()]).then(
        ([done, adminUnlocked]) => {
          if (adminUnlocked) {
            router.replace('/admin');
            return;
          }
          router.replace(done ? '/' : '/onboarding');
        }
      );
      return;
    }

    if (!inOnboarding && !inAdmin) {
      AsyncStorage.getItem('onboarding_complete').then(done => {
        if (!done) router.replace('/onboarding');
      });
    }
  }, [user, loading, pathname, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGuard />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="learn/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="learn-blanks/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="sutra/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="flashcard/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="recite/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="complete/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="badges" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
