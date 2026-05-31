import { useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential, UserCredential } from 'firebase/auth';
import { auth } from './firebase';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function useGoogleSignIn() {
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: webClientId ?? undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  const signInWithGoogle = useCallback(async (): Promise<UserCredential> => {
    if (!webClientId) {
      throw new Error(
        'Google sign-in is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.',
      );
    }

    const result = await promptAsync();
    if (result?.type !== 'success') {
      throw new Error('Google sign-in was cancelled.');
    }

    const idToken = result.params.id_token;
    const accessToken = result.params.access_token;
    if (!idToken) {
      throw new Error('Google sign-in did not return an ID token.');
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    return signInWithCredential(auth, credential);
  }, [promptAsync]);

  return { signInWithGoogle, ready: !!request && !!webClientId };
}
