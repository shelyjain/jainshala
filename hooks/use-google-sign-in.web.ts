import { useCallback } from 'react';
import { signInWithGoogle as signInWithGoogleWeb } from '../lib/google-sign-in';

export function useGoogleSignIn() {
  const signInWithGoogle = useCallback(() => signInWithGoogleWeb(), []);

  return { signInWithGoogle, ready: true };
}
