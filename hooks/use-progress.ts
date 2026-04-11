import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export type SutraProgress = {
  read: boolean;
  learn: boolean;
  recite: boolean;
};

export function useProgress() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [progressDetails, setProgressDetails] = useState<Record<string, SutraProgress>>({});

  useEffect(() => {
    AsyncStorage.getItem('completed_sutras').then(val => {
      if (val) setCompleted(JSON.parse(val));
    });
    AsyncStorage.getItem('progress_details').then(val => {
      if (val) setProgressDetails(JSON.parse(val));
    });
  }, []);

  const markComplete = async (id: string) => {
    const updated = completed.includes(id) ? completed : [...completed, id];
    setCompleted(updated);
    await AsyncStorage.setItem('completed_sutras', JSON.stringify(updated));
  };

  const markStep = async (id: string, step: keyof SutraProgress) => {
    const currentProgress = progressDetails[id] || { read: false, learn: false, recite: false };
    const newProgressDetails = {
      ...progressDetails,
      [id]: {
        ...currentProgress,
        [step]: true
      }
    };
    setProgressDetails(newProgressDetails);
    await AsyncStorage.setItem('progress_details', JSON.stringify(newProgressDetails));
  };

  const isCompleted = (id: string) => completed.includes(id);

  const getStepProgress = (id: string): SutraProgress => {
     if (isCompleted(id)) {
        return { read: true, learn: true, recite: true };
     }
     return progressDetails[id] || { read: false, learn: false, recite: false };
  }

  return { completed, progressDetails, markComplete, isCompleted, markStep, getStepProgress };
}