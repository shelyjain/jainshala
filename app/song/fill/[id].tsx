import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useProgress } from '../../../hooks/use-progress';

type SongLine = {
  audio_url: string;
  gujarati?: string;
  transliteration: string;
  translation_en: string;
};

type Song = {
  id: string;
  title: string;
  artist: string;
  lines: SongLine[];
};

type WordState = 'visible' | 'hidden' | 'revealed';

function makeWordStates(transliteration: string): { word: string; state: WordState }[] {
  return transliteration.split(' ').map((word, i) => ({
    word,
    state: (i % 3 === 1 ? 'hidden' : 'visible') as WordState,
  }));
}

export default function SongFill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [wordStates, setWordStates] = useState<{ word: string; state: WordState }[]>([]);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const { markStep } = useProgress();

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'songs', String(id)));
        if (snap.exists()) {
          const s = { id: snap.id, ...snap.data() } as Song;
          setSong(s);
          if (s.lines.length > 0) setWordStates(makeWordStates(s.lines[0].transliteration));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
    return () => {
      void soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [id]);

  const playLine = async (index: number) => {
    if (!song) return;
    const line = song.lines[index];
    if (!line?.audio_url) return;
    try {
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: line.audio_url },
        { shouldPlay: true },
        (status) => { if (status.isLoaded) setPlaying(status.isPlaying); }
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const revealWord = (i: number) => {
    setWordStates(prev => prev.map((w, wi) => wi === i ? { ...w, state: 'revealed' as const } : w));
  };

  const allRevealed = wordStates.every(w => w.state !== 'hidden');

  const next = async () => {
    if (!song) return;
    await soundRef.current?.stopAsync();
    if (current < song.lines.length - 1) {
      const n = current + 1;
      setCurrent(n);
      setWordStates(makeWordStates(song.lines[n].transliteration));
      await playLine(n);
    } else {
      await markStep(String(id), 'learn_fill');
      router.replace(`/song/${id}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#8b6914" /></View>
      </SafeAreaView>
    );
  }

  if (!song) return null;

  const line = song.lines[current];
  const isLast = current === song.lines.length - 1;
  const pct = song.lines.length > 0 ? ((current + 1) / song.lines.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{song.title} — Fill in</Text>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{current + 1} / {song.lines.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.activeLine}>
          <View style={styles.wordsRow}>
            {wordStates.map((w, i) =>
              w.state === 'hidden' ? (
                <TouchableOpacity key={i} style={styles.blank} onPress={() => revealWord(i)}>
                  <Text style={styles.blankText}>{'_ '.repeat(Math.max(3, w.word.length))}</Text>
                </TouchableOpacity>
              ) : (
                <Text key={i} style={[styles.word, w.state === 'revealed' && styles.wordRevealed]}>
                  {w.word}{' '}
                </Text>
              )
            )}
          </View>
          {line.translation_en ? (
            <Text style={styles.translation}>{line.translation_en}</Text>
          ) : null}
        </View>
        {!allRevealed && <Text style={styles.hint}>Tap the blanks to reveal missing words</Text>}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.playBtn} onPress={() => playLine(current)}>
          <Text style={styles.playBtnText}>{playing ? '🔁' : '▶'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, !allRevealed && styles.nextBtnDisabled]}
          onPress={next} disabled={!allRevealed}
        >
          <Text style={styles.nextBtnText}>{isLast ? '✓ Done' : 'Next ›'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf8f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 12 },
  backText: { fontSize: 17, color: '#8b6914', fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#ebe6e0', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#8b6914', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#999', fontWeight: '600', minWidth: 40, textAlign: 'right' },
  content: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1, justifyContent: 'center' },
  activeLine: { backgroundColor: '#fffbf0', borderRadius: 18, padding: 22, borderWidth: 1.5, borderColor: '#c9a227' },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 },
  word: { fontSize: 16, color: '#8b6914', fontStyle: 'italic', fontWeight: '600' },
  wordRevealed: { color: '#3a7a3a', fontStyle: 'normal', fontWeight: '700' },
  blank: { backgroundColor: '#fff8ec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1.5, borderColor: '#c9a227', borderStyle: 'dashed' },
  blankText: { fontSize: 14, color: '#c9a227', letterSpacing: 2 },
  translation: { fontSize: 13, color: '#5c4a2e', lineHeight: 20 },
  hint: { fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ede8e2', gap: 12 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5ede4', alignItems: 'center', justifyContent: 'center' },
  playBtnText: { fontSize: 22 },
  nextBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: '#8b6914', alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#c4bbb1' },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
