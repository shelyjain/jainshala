import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Sutra } from '../types/sutra';
import { isFirestorePermissionError } from './firestore-user';

const sutrasCol = () => collection(db, 'sutras');

export async function listSutrasFromFirestore(): Promise<Sutra[]> {
  const q = query(sutrasCol(), orderBy('sutra_number'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sutra));
}

export async function getSutraFromFirestore(id: string): Promise<Sutra | null> {
  const snap = await getDoc(doc(db, 'sutras', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Sutra;
}

export async function saveSutraToFirestore(sutra: Sutra): Promise<boolean> {
  const { id, ...data } = sutra;
  try {
    await setDoc(doc(db, 'sutras', id), data, { merge: true });
    return true;
  } catch (err: unknown) {
    if (isFirestorePermissionError(err)) return false;
    throw err;
  }
}

export async function deleteSutraFromFirestore(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'sutras', id));
    return true;
  } catch (err: unknown) {
    if (isFirestorePermissionError(err)) return false;
    throw err;
  }
}
