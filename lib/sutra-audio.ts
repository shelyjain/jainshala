import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unzipSync } from 'fflate';
import { API_URL } from '../constants/api';

const STORAGE_KEY = 'downloaded_sutras';

// On web we store MP3s as base64 in AsyncStorage keyed by path
// On native we store to the filesystem
let FileSystem: typeof import('expo-file-system/legacy') | null = null;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
}

function baseDir(): string {
  return `${FileSystem?.documentDirectory ?? ''}sutras/`;
}

export function localLinePath(sutraNumber: number, lineNumber: number): string {
  return `${baseDir()}sutra${sutraNumber}/sutra${sutraNumber}line${lineNumber}.mp3`;
}

export async function isSutraDownloaded(sutraNumber: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const downloaded: number[] = raw ? JSON.parse(raw) : [];
    return downloaded.includes(sutraNumber);
  } catch {
    return false;
  }
}

async function markDownloaded(sutraNumber: number) {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const downloaded: number[] = raw ? JSON.parse(raw) : [];
  if (!downloaded.includes(sutraNumber)) {
    downloaded.push(sutraNumber);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloaded));
  }
}

async function fetchZipBytes(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const contentLength = Number(resp.headers.get('content-length') ?? 0);
  if (!resp.body || contentLength === 0) {
    // No streaming support — just read all at once
    const buf = await resp.arrayBuffer();
    onProgress?.(1);
    return new Uint8Array(buf);
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) onProgress?.(received / contentLength);
  }
  onProgress?.(1);
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function downloadSutraAudio(
  sutraNumber: number,
  driveFileId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  // Web: proxy through backend to avoid CORS. Native: fetch Drive directly.
  const url = Platform.OS === 'web'
    ? `${API_URL}/sutra-audio-proxy/${sutraNumber}`
    : `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
  const zipBytes = await fetchZipBytes(url, onProgress);
  const files = unzipSync(zipBytes);

  if (Platform.OS === 'web') {
    // Store each MP3 as base64 in AsyncStorage
    for (const [filename, data] of Object.entries(files)) {
      if (!filename.endsWith('.mp3')) continue;
      const bytes = data as Uint8Array;
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      await AsyncStorage.setItem(`sutra_audio:${filename}`, b64);
    }
  } else {
    const outDir = `${baseDir()}sutra${sutraNumber}/`;
    await FileSystem!.makeDirectoryAsync(outDir, { intermediates: true });
    for (const [filename, data] of Object.entries(files)) {
      if (!filename.endsWith('.mp3')) continue;
      const bytes = data as Uint8Array;
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      await FileSystem!.writeAsStringAsync(`${outDir}${filename}`, b64, {
        encoding: (FileSystem as any).EncodingType.Base64,
      });
    }
  }

  await markDownloaded(sutraNumber);
}

export async function deleteSutraAudio(sutraNumber: number): Promise<void> {
  if (Platform.OS === 'web') {
    const keys = await AsyncStorage.getAllKeys();
    const sutraKeys = keys.filter(k => k.startsWith(`sutra_audio:sutra${sutraNumber}line`));
    await AsyncStorage.multiRemove(sutraKeys);
  } else {
    const dir = `${baseDir()}sutra${sutraNumber}/`;
    await FileSystem!.deleteAsync(dir, { idempotent: true });
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const downloaded: number[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloaded.filter(n => n !== sutraNumber)));
}

// Used by flashcard screen on web to get a playable URI from AsyncStorage
export async function getWebAudioUri(sutraNumber: number, lineNumber: number): Promise<string | null> {
  const key = `sutra_audio:sutra${sutraNumber}line${lineNumber}.mp3`;
  const b64 = await AsyncStorage.getItem(key);
  if (!b64) return null;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}
