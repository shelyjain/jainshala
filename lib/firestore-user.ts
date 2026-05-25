import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function getUserDoc(uid: string) {
  return getDoc(userDocRef(uid));
}

/** Writes merge fields; returns false if Firestore rules blocked the write. */
export async function mergeUserDoc(
  uid: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    await setDoc(userDocRef(uid), data, { merge: true });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') {
      console.warn('[Firestore] permission-denied — update rules in Firebase Console.');
      return false;
    }
    throw err;
  }
}
