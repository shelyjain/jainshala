import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { API_URL } from '@/constants/api';

let googleTtsEnabledCache: boolean | null = null;

/** Uses backend `/tts/google` when configured (recommended for Hindi / Devanagari mantra lines). */
export function shouldUseGoogleCloudTts(): boolean {
  const v = process.env.EXPO_PUBLIC_USE_GOOGLE_TTS?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return true;
}

export function normalizeForGoogleTts(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Prefer Devanagari overlay text for Google TTS when available. */
export function prepareTtsLineText(transliteration: string, ttsDevanagari?: string) {
  const dev = ttsDevanagari?.trim();
  if (dev) return dev;
  return transliteration.trim();
}

export async function isGoogleCloudTtsEnabled(): Promise<boolean> {
  if (googleTtsEnabledCache !== null) return googleTtsEnabledCache;
  try {
    const r = await fetch(`${API_URL}/tts/google/status`);
    const j = await r.json().catch(() => ({}));
    googleTtsEnabledCache = !!(r.ok && j.enabled);
  } catch {
    googleTtsEnabledCache = false;
  }
  return googleTtsEnabledCache;
}

export function resetGoogleTtsEnabledCache() {
  googleTtsEnabledCache = null;
}

type SpeakCallbacks = {
  onDone?: () => void;
  onError?: () => void;
};

function getDeviceTtsProsody(): { rate: number; pitch: number } {
  let rate = 0.82;
  const rEnv = process.env.EXPO_PUBLIC_TTS_RATE?.trim();
  if (rEnv) {
    const n = Number(rEnv);
    if (!Number.isNaN(n)) rate = Math.min(2, Math.max(0.1, n));
  }
  let pitch = 0.98;
  const pEnv = process.env.EXPO_PUBLIC_TTS_PITCH?.trim();
  if (pEnv) {
    const n = Number(pEnv);
    if (!Number.isNaN(n)) pitch = Math.min(2, Math.max(0.5, n));
  }
  return { rate, pitch };
}

async function stopGoogleSound(
  soundRef: MutableRefObject<Audio.Sound | null>,
  webUrlRef: MutableRefObject<string | null>,
) {
  if (soundRef.current) {
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    } catch {
      /* ignore */
    }
    soundRef.current = null;
  }
  if (webUrlRef.current && Platform.OS === 'web') {
    URL.revokeObjectURL(webUrlRef.current);
    webUrlRef.current = null;
  }
}

/**
 * Play Indic mantra text via Google Cloud TTS (backend) with on-device expo-speech fallback.
 */
export function useGoogleIndicTts() {
  const googleSoundRef = useRef<Audio.Sound | null>(null);
  const googleWebUrlRef = useRef<string | null>(null);
  const speechTokenRef = useRef(0);

  const stop = useCallback(async () => {
    speechTokenRef.current += 1;
    await stopGoogleSound(googleSoundRef, googleWebUrlRef);
    Speech.stop();
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    return () => {
      void stop();
    };
  }, [stop]);

  const speak = useCallback(
    async (rawText: string, callbacks?: SpeakCallbacks) => {
      const text = rawText.trim();
      if (!text) {
        callbacks?.onError?.();
        return;
      }

      const speechToken = speechTokenRef.current + 1;
      speechTokenRef.current = speechToken;
      await stopGoogleSound(googleSoundRef, googleWebUrlRef);
      Speech.stop();

      const prepared = prepareTtsLineText(text);
      const googlePayloadText = normalizeForGoogleTts(prepared);
      const { rate, pitch } = getDeviceTtsProsody();

      const runDeviceSpeech = () => {
        if (speechToken !== speechTokenRef.current) return;
        Speech.speak(prepared, {
          language: 'hi-IN',
          rate,
          pitch,
          onDone: () => {
            if (speechToken !== speechTokenRef.current) return;
            callbacks?.onDone?.();
          },
          onError: () => {
            if (speechToken !== speechTokenRef.current) return;
            callbacks?.onError?.();
          },
        });
      };

      if (shouldUseGoogleCloudTts() && (await isGoogleCloudTtsEnabled())) {
        try {
          const res = await fetch(`${API_URL}/tts/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: googlePayloadText, mantra_style: true }),
          });
          if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
          if (speechToken !== speechTokenRef.current) return;

          let uri: string;
          if (Platform.OS === 'web') {
            const blob = await res.blob();
            uri = URL.createObjectURL(blob);
            googleWebUrlRef.current = uri;
          } else {
            const buf = await res.arrayBuffer();
            const outFile = new File(Paths.cache, `tts-${Date.now()}.mp3`);
            outFile.write(new Uint8Array(buf));
            uri = outFile.uri;
          }

          if (speechToken !== speechTokenRef.current) {
            if (Platform.OS === 'web' && googleWebUrlRef.current) {
              URL.revokeObjectURL(googleWebUrlRef.current);
              googleWebUrlRef.current = null;
            }
            return;
          }

          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true },
            status => {
              if (!status.isLoaded) {
                if (status.error) {
                  void sound.unloadAsync().catch(() => {});
                  googleSoundRef.current = null;
                  if (googleWebUrlRef.current && Platform.OS === 'web') {
                    URL.revokeObjectURL(googleWebUrlRef.current);
                    googleWebUrlRef.current = null;
                  }
                  if (speechToken !== speechTokenRef.current) return;
                  callbacks?.onError?.();
                }
                return;
              }
              if (status.didJustFinish) {
                void sound.unloadAsync().catch(() => {});
                googleSoundRef.current = null;
                if (googleWebUrlRef.current && Platform.OS === 'web') {
                  URL.revokeObjectURL(googleWebUrlRef.current);
                  googleWebUrlRef.current = null;
                }
                if (speechToken !== speechTokenRef.current) return;
                callbacks?.onDone?.();
              }
            },
          );
          googleSoundRef.current = sound;
          return;
        } catch (e) {
          console.warn('Google Indic TTS failed, using device speech', e);
        }
      }

      runDeviceSpeech();
    },
    [],
  );

  return { speak, stop };
}
