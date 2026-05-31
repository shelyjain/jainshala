import { UserCredential } from 'firebase/auth';

export async function completeGoogleRedirectSignIn(): Promise<UserCredential | null> {
  return null;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  throw new Error('Google sign-in is only configured for web in this build.');
}
