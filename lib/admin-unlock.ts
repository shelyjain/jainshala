import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_UNLOCK_KEY = 'admin_portal_unlocked';

export async function isAdminPortalUnlocked(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ADMIN_UNLOCK_KEY);
  return v === '1';
}

export async function setAdminPortalUnlocked(unlocked: boolean): Promise<void> {
  if (unlocked) {
    await AsyncStorage.setItem(ADMIN_UNLOCK_KEY, '1');
  } else {
    await AsyncStorage.removeItem(ADMIN_UNLOCK_KEY);
  }
}
