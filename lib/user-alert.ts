import { Alert, Platform } from 'react-native';

export function showUserAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function firebaseAuthErrorMessage(err: unknown, fallback = 'Sign-in failed. Please try again.'): string {
  const code = (err as { code?: string })?.code;
  const message = err instanceof Error ? err.message : fallback;

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. In Firebase Console → Authentication → Sign-in method, turn on Google.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site, or we will try redirect sign-in.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. In Firebase Console → Authentication → Settings → Authorized domains, add localhost.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return message || fallback;
  }
}

export function isAuthCancellation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return true;
  }
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return message.includes('cancel');
}
