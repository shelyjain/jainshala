import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type SutraProgress = {
  read: boolean;
  learn: boolean;
  recite: boolean;
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
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        setCompleted(data.completedSutras ?? []);
        setProgressDetails(data.progressDetails ?? {});
      }
    } catch {
      loadFromAsyncStorage();
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
      await setDoc(doc(db, 'users', uid), { completedSutras: updated }, { merge: true });
    }
    await AsyncStorage.setItem('completed_sutras', JSON.stringify(updated));
  };

  const markStep = async (id: string, step: keyof SutraProgress) => {
    const current = progressDetails[id] ?? { read: false, learn: false, recite: false };
    const newDetails = {
      ...progressDetails,
      [id]: { ...current, [step]: true },
    };
    setProgressDetails(newDetails);

    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, 'users', uid), { progressDetails: newDetails }, { merge: true });
    }
    await AsyncStorage.setItem('progress_details', JSON.stringify(newDetails));
  };

  const isCompleted = (id: string) => completed.includes(id);

  const getStepProgress = (id: string): SutraProgress => {
    if (isCompleted(id)) return { read: true, learn: true, recite: true };
    return progressDetails[id] ?? { read: false, learn: false, recite: false };
  };

  return { completed, progressDetails, markComplete, isCompleted, markStep, getStepProgress };
}
