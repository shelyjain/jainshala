import { useCallback, useState } from 'react';
import {
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getSutraFromFirestore,
  saveSutraToFirestore,
  deleteSutraFromFirestore,
} from '../../../lib/firestore-sutras';
import type { Sutra, SutraLine } from '../../../types/sutra';

function parseLinesJson(raw: string): SutraLine[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((line, i) => ({
      line_number: Number(line.line_number ?? i + 1),
      transliteration: String(line.transliteration ?? ''),
      translation_en: String(line.translation_en ?? ''),
      ...(line.tts_devanagari ? { tts_devanagari: String(line.tts_devanagari) } : {}),
    }));
  } catch {
    return null;
  }
}

export default function AdminEditSutraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [sutraNumber, setSutraNumber] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [tags, setTags] = useState('');
  const [linesJson, setLinesJson] = useState('[]');
  const [badgeEpithet, setBadgeEpithet] = useState('');
  const [badgeEmoji, setBadgeEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const sutra = await getSutraFromFirestore(String(id));
    if (!sutra) {
      Alert.alert('Not found', 'Sutra missing in Firestore.');
      router.back();
      return;
    }
    setTitle(sutra.title);
    setCategory(sutra.category);
    setSutraNumber(String(sutra.sutra_number ?? ''));
    setInterpretation(sutra.interpretation ?? '');
    setTags((sutra.tags ?? []).join(', '));
    setLinesJson(JSON.stringify(sutra.lines ?? [], null, 2));
    setBadgeEpithet(sutra.badgeEpithet ?? '');
    setBadgeEmoji(sutra.badgeEmoji ?? '');
    setLoading(false);
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSave = async () => {
    if (!id) return;
    const lines = parseLinesJson(linesJson);
    if (!lines) {
      Alert.alert('Invalid lines', 'Lines must be valid JSON.');
      return;
    }
    const sutra: Sutra = {
      id: String(id),
      title: title.trim(),
      category: category.trim(),
      sutra_number: Number(sutraNumber) || 0,
      original_gu: '',
      original_hi: '',
      lines,
      interpretation: interpretation.trim(),
      tags: tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      ...(badgeEpithet.trim() ? { badgeEpithet: badgeEpithet.trim() } : {}),
      ...(badgeEmoji.trim() ? { badgeEmoji: badgeEmoji.trim() } : {}),
    };
    setSaving(true);
    const ok = await saveSutraToFirestore(sutra);
    setSaving(false);
    if (!ok) {
      Alert.alert('Denied', 'Could not save sutra.');
      return;
    }
    Alert.alert('Saved', 'Sutra updated.');
  };

  const handleDelete = () => {
    Alert.alert('Delete sutra', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const ok = await deleteSutraFromFirestore(String(id));
          if (!ok) {
            Alert.alert('Denied', 'Could not delete.');
            return;
          }
          router.replace('/admin/sutras');
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color="#a0522d" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.idLabel}>ID: {id}</Text>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Category" value={category} onChangeText={setCategory} />
      <Field label="Sutra number" value={sutraNumber} onChangeText={setSutraNumber} keyboardType="number-pad" />
      <Field label="Interpretation" value={interpretation} onChangeText={setInterpretation} multiline />
      <Field label="Tags" value={tags} onChangeText={setTags} />
      <Text style={styles.section}>Badge assignment</Text>
      <Field label="Badge epithet" value={badgeEpithet} onChangeText={setBadgeEpithet} placeholder="e.g. Radiant Seeker" />
      <Field label="Badge emoji" value={badgeEmoji} onChangeText={setBadgeEmoji} placeholder="e.g. 🪷" />
      <Text style={styles.label}>Lines (JSON)</Text>
      <TextInput
        style={[styles.input, styles.json]}
        value={linesJson}
        onChangeText={setLinesJson}
        multiline
        textAlignVertical="top"
      />
      <TouchableOpacity style={styles.btn} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteText}>Delete sutra</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 48 },
  idLabel: { fontSize: 13, color: '#888', marginBottom: 8 },
  section: { fontSize: 16, fontWeight: '700', color: '#a0522d', marginTop: 16, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  json: { minHeight: 200, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btn: {
    marginTop: 24,
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  deleteBtn: { marginTop: 20, padding: 14, alignItems: 'center' },
  deleteText: { color: '#c0392b', fontWeight: '600' },
});
