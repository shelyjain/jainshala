import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserDoc, mergeUserDoc } from '../lib/firestore-user';

export type SutraProgress = {
  read: boolean;
  listen: boolean;
  /** Level 1: drag lines into correct sequence */
  learn: boolean;
  /** Level 2: fill in the blanks */
  learn_fill: boolean;
  /** Level 3: meaning → transliteration MCQ quiz */
  recite: boolean;
};

const DEFAULT_PROGRESS: SutraProgress = {
  read: false,
  listen: false,
  learn: false,
  learn_fill: false,
  recite: false,
};

export function useProgress() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [progressDetails, setProgressDetails] = useState<Record<string, SutraProgress>>({});

  useEffect(() => {
    // Load initial progress and re-load whenever auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadFromFirestore(user.uid);
      } else {
        loadFromAsyncStorage();
      }
    });
    return unsubscribe;
  }, []);

  const loadFromFirestore = async (uid: string) => {
    try {
      const snap = await getUserDoc(uid);
      if (snap.exists()) {
        const data = snap.data();
        setCompleted(data.completedSutras ?? []);
        setProgressDetails(data.progressDetails ?? {});
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'permission-denied') {
        console.warn('[Firestore] permission-denied on read — using local progress only.');
      }
      await loadFromAsyncStorage();
    }
  };

  const loadFromAsyncStorage = async () => {
    const [c, p] = await Promise.all([
      AsyncStorage.getItem('completed_sutras'),
      AsyncStorage.getItem('progress_details'),
    ]);
    if (c) setCompleted(JSON.parse(c));
    if (p) setProgressDetails(JSON.parse(p));
  };

  const markComplete = async (id: string) => {
    const updated = completed.includes(id) ? completed : [...completed, id];
    setCompleted(updated);

    const uid = auth.currentUser?.uid;
    if (uid) {
      await mergeUserDoc(uid, { completedSutras: updated });
    }
    await AsyncStorage.setItem('completed_sutras', JSON.stringify(updated));
  };

  const markStep = async (id: string, step: keyof SutraProgress) => {
    const current = { ...DEFAULT_PROGRESS, ...progressDetails[id] };
    const newDetails = {
      ...progressDetails,
      [id]: { ...current, [step]: true },
    };
    setProgressDetails(newDetails);

    const uid = auth.currentUser?.uid;
    if (uid) {
      await mergeUserDoc(uid, { progressDetails: newDetails });
    }
    await AsyncStorage.setItem('progress_details', JSON.stringify(newDetails));
  };

  const isCompleted = (id: string) => completed.includes(id);

  const getStepProgress = (id: string): SutraProgress => {
    if (isCompleted(id))
      return { read: true, listen: true, learn: true, learn_fill: true, recite: true };
    return { ...DEFAULT_PROGRESS, ...progressDetails[id] };
  };

  return { completed, progressDetails, markComplete, isCompleted, markStep, getStepProgress };
}
