import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

export function isFirestorePermissionError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'permission-denied';
}

export async function getUserDoc(uid: string) {
  return getDoc(userDocRef(uid));
}

/** Returns null when Firestore rules block the read (user may still be signed in). */
export async function getUserDocSafe(uid: string) {
  try {
    return await getUserDoc(uid);
  } catch (err: unknown) {
    if (isFirestorePermissionError(err)) {
      console.warn('[Firestore] permission-denied on read — check deployed rules.');
      return null;
    }
    throw err;
  }
}

/** Live profile updates (roles, progress, etc.). */
export function subscribeUserDoc(
  uid: string,
  onUpdate: (data: Record<string, unknown> | null, error: 'permission' | null) => void
): () => void {
  return onSnapshot(
    userDocRef(uid),
    snap => {
      onUpdate(snap.exists() ? (snap.data() as Record<string, unknown>) : null, null);
    },
    err => {
      if (isFirestorePermissionError(err)) {
        console.warn('[Firestore] permission-denied on subscribe — deploy firestore.rules.');
        onUpdate(null, 'permission');
        return;
      }
      console.error('[Firestore] subscribe error:', err);
      onUpdate(null, null);
    }
  );
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
    if (isFirestorePermissionError(err)) {
      console.warn('[Firestore] permission-denied on write — check deployed rules.');
      return false;
    }
    throw err;
  }
}
