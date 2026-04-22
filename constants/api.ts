import { Platform } from 'react-native';

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
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
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL = fromEnv ? stripTrailingSlash(fromEnv) : defaultApiUrl();
