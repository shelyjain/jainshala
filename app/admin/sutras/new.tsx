import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { saveSutraToFirestore } from '../../../lib/firestore-sutras';
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

const DEFAULT_LINES = `[
  { "line_number": 1, "transliteration": "", "translation_en": "" }
]`;

export default function AdminNewSutraScreen() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [sutraNumber, setSutraNumber] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [tags, setTags] = useState('');
  const [linesJson, setLinesJson] = useState(DEFAULT_LINES);
  const [badgeEpithet, setBadgeEpithet] = useState('');
  const [badgeEmoji, setBadgeEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const sid = id.trim();
    if (!sid || !title.trim() || !category.trim()) {
      Alert.alert('Missing fields', 'ID, title, and category are required.');
      return;
    }
    const lines = parseLinesJson(linesJson);
    if (!lines || lines.length === 0) {
      Alert.alert('Invalid lines', 'Lines must be a JSON array with transliteration and translation.');
      return;
    }

    const sutra: Sutra = {
      id: sid,
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
      Alert.alert('Denied', 'Could not save. Check Firestore rules and admin role.');
      return;
    }
    Alert.alert('Saved', 'Sutra uploaded to Firestore.');
    router.replace(`/admin/sutras/${sid}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="ID" value={id} onChangeText={setId} placeholder="e.g. 23" />
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Category" value={category} onChangeText={setCategory} />
      <Field label="Sutra number" value={sutraNumber} onChangeText={setSutraNumber} keyboardType="number-pad" />
      <Field label="Interpretation" value={interpretation} onChangeText={setInterpretation} multiline />
      <Field label="Tags (comma-separated)" value={tags} onChangeText={setTags} />
      <Field label="Badge epithet (optional)" value={badgeEpithet} onChangeText={setBadgeEpithet} />
      <Field label="Badge emoji (optional)" value={badgeEmoji} onChangeText={setBadgeEmoji} />
      <Text style={styles.label}>Lines (JSON array)</Text>
      <TextInput
        style={[styles.input, styles.json]}
        value={linesJson}
        onChangeText={setLinesJson}
        multiline
        textAlignVertical="top"
      />
      <TouchableOpacity style={styles.btn} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save to Firestore</Text>}
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
  content: { padding: 16, paddingBottom: 40 },
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
  json: { minHeight: 160, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btn: {
    marginTop: 24,
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
