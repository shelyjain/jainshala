import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertFirebaseEnv, firebaseConfig } from './firebase-config';

assertFirebaseEnv();

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function initNativeAuth() {
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
}

export const auth = initNativeAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
