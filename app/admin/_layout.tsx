import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#a0522d',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="sutras/index" options={{ title: 'Sutras' }} />
      <Stack.Screen name="sutras/new" options={{ title: 'Upload Sutra' }} />
      <Stack.Screen name="sutras/[id]" options={{ title: 'Edit Sutra' }} />
      <Stack.Screen name="songs/index" options={{ title: 'Songs' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
    </Stack>
  );
}
