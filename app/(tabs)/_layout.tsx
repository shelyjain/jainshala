import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import 'react-native-gesture-handler';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TAB_ICON = 26;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tabActive = isDark ? '#e8c49a' : '#a0522d';
  const tabInactive = isDark ? '#8a8078' : '#8a8177';
  const tabBarBg = isDark ? '#2a241c' : '#fdf8f4';
  const tabBorder = isDark ? '#3d3428' : '#e8dfd6';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: tabActive,
        tabBarInactiveTintColor: tabInactive,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tabBorder,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 10,
          paddingTop: Platform.OS === 'android' ? 6 : 8,
          paddingBottom: Platform.OS === 'android' ? 6 : undefined,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginBottom: Platform.OS === 'android' ? 4 : 2,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'ios' ? 2 : 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON} name="star.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
