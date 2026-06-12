import { Platform } from 'react-native';
import Constants from 'expo-constants';

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function inferExpoHostApiUrl(): string | null {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (typeof hostUri !== 'string' || !hostUri) return null;
  const host = hostUri.split(':')[0];
  if (!host) return null;
  return `http://${host}:8000`;
}

/**
 * API base URL for the FastAPI backend (`backend/main.py`).
 *
 * - Set `EXPO_PUBLIC_API_URL` in `.env` when using a physical device (use your PC's LAN IP, e.g. `http://192.168.1.5:8000`).
 * - Web defaults to `localhost` so the browser can reach a backend running on the same machine.
 * - Android emulator defaults to `10.0.2.2` (host loopback from the emulator).
 */
function defaultApiUrl(): string {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  if (Platform.OS === 'android') {
    const expoHostApi = inferExpoHostApiUrl();
    if (expoHostApi) return expoHostApi;
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  // EXPO_PUBLIC_API_URL is for physical devices; web always uses localhost.
  if (Platform.OS !== 'web' && fromEnv) {
    return stripTrailingSlash(fromEnv);
  }
  return defaultApiUrl();
}

export const API_URL = resolveApiUrl();
