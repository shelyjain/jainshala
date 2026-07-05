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

export default function SongListenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { markStep } = useProgress();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'songs', String(id)));
        if (snap.exists()) setSong({ id: snap.id, ...snap.data() } as Song);
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

  const next = async () => {
    if (!song) return;
    await soundRef.current?.stopAsync();
    if (current < song.lines.length - 1) {
      const n = current + 1;
      setCurrent(n);
      await playLine(n);
    } else {
      await markStep(String(id), 'listen');
      router.replace(`/song/${id}`);
    }
  };

  const prev = async () => {
    if (current === 0) return;
    await soundRef.current?.stopAsync();
    const p = current - 1;
    setCurrent(p);
    await playLine(p);
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
        <Text style={styles.headerTitle} numberOfLines={1}>{song.title}</Text>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{current + 1} / {song.lines.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {song.lines.slice(0, current).map((l, i) => (
          <View key={i} style={styles.pastLine}>
            <Text style={styles.pastTranslit}>{l.transliteration}</Text>
          </View>
        ))}
        <View style={styles.activeLine}>
          <Text style={styles.activeTranslit}>{line.transliteration}</Text>
          {line.translation_en ? (
            <Text style={styles.activeTranslation}>{line.translation_en}</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.sideBtn, current === 0 && styles.sideBtnDisabled]}
          onPress={prev} disabled={current === 0}
        >
          <Text style={styles.sideBtnText}>‹ Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={() => playLine(current)}>
          <Text style={styles.playBtnText}>{playing ? '🔁' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sideBtn, styles.nextBtn]} onPress={next}>
          <Text style={[styles.sideBtnText, styles.nextBtnText]}>{isLast ? '✓ Done' : 'Next ›'}</Text>
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
  content: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1, justifyContent: 'flex-end' },
  pastLine: { marginBottom: 10, opacity: 0.35 },
  pastTranslit: { fontSize: 15, color: '#8b6914', fontStyle: 'italic' },
  activeLine: { backgroundColor: '#fffbf0', borderRadius: 18, padding: 22, borderWidth: 1.5, borderColor: '#c9a227', marginBottom: 8 },
  activeTranslit: { fontSize: 20, color: '#8b6914', fontStyle: 'italic', fontWeight: '700', marginBottom: 10, lineHeight: 28 },
  activeTranslation: { fontSize: 13, color: '#5c4a2e', lineHeight: 20 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ede8e2', gap: 12 },
  sideBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f5ede4', alignItems: 'center' },
  sideBtnDisabled: { opacity: 0.3 },
  sideBtnText: { fontSize: 15, fontWeight: '700', color: '#8b6914' },
  nextBtn: { backgroundColor: '#8b6914' },
  nextBtnText: { color: '#fff' },
  playBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#8b6914', alignItems: 'center', justifyContent: 'center' },
  playBtnText: { fontSize: 24, color: '#fff' },
});
