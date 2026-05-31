import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/** Call once on web app load to finish redirect-based Google sign-in. */
export async function completeGoogleRedirectSignIn(): Promise<UserCredential | null> {
  const result = await getRedirectResult(auth);
  return result;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = googleProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      // Page navigates away; this promise intentionally never resolves.
      return await new Promise<UserCredential>(() => {});
    }
    throw err;
  }
}
