import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';

type SongLineInput = {
  timestamp_ms: string;
  gujarati: string;
  transliteration: string;
  translation_en: string;
};

type SongData = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  lines: SongLineInput[];
};

export default function AdminScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<SongData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [songId, setSongId] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [lines, setLines] = useState<SongLineInput[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'songs'));
      const list: SongData[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const mappedLines = (data.lines || []).map((l: any) => ({
          timestamp_ms: String(l.timestamp_ms || 0),
          gujarati: l.gujarati || '',
          transliteration: l.transliteration || '',
          translation_en: l.translation_en || '',
        }));
        list.push({
          id: docSnap.id,
          title: data.title || '',
          artist: data.artist || '',
          audio_url: data.audio_url || '',
          lines: mappedLines,
        });
      });
      setSongs(list);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch songs. Check Firestore rules or database connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSongs();
  }, []);

  const handleEdit = (song: SongData) => {
    setSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setAudioUrl(song.audio_url);
    setLines([...song.lines]);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'songs', id));
        Alert.alert('Deleted', 'Song deleted successfully.');
        void fetchSongs();
        resetForm();
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to delete song.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this song?')) {
        void performDelete();
      }
      return;
    }

    Alert.alert('Delete Song', 'Are you sure you want to delete this song?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { timestamp_ms: '0', gujarati: '', transliteration: '', translation_en: '' },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof SongLineInput, val: string) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const resetForm = () => {
    setSongId('');
    setTitle('');
    setArtist('');
    setAudioUrl('');
    setLines([]);
    setIsEditing(false);
  };

  const handleWebFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadAudioFile(file);
  };

  const uploadAudioFile = async (file: any) => {
    setUploading(true);
    try {
      const storageRef = ref(storage, `songs/${Date.now()}_${file.name}`);
      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);
      setAudioUrl(url);
      Alert.alert('Uploaded', 'Audio file uploaded to Firebase Storage.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload Failed', e.message || 'Failed to upload audio file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!songId.trim() || !title.trim() || !audioUrl.trim()) {
      Alert.alert('Validation Error', 'Song ID, Title, and Audio URL are required.');
      return;
    }

    setSaving(true);
    try {
      const formattedLines = lines.map(l => ({
        timestamp_ms: parseInt(l.timestamp_ms, 10) || 0,
        gujarati: l.gujarati.trim(),
        transliteration: l.transliteration.trim(),
        translation_en: l.translation_en.trim(),
      }));

      // Sort lines by timestamp to ensure proper progression
      formattedLines.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

      await setDoc(doc(db, 'songs', songId.trim()), {
        title: title.trim(),
        artist: artist.trim(),
        audio_url: audioUrl.trim(),
        lines: formattedLines,
      });

      Alert.alert('Saved', 'Song saved successfully.');
      resetForm();
      void fetchSongs();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Save Failed', e.message || 'Failed to save song data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Admin Dashboard</Text>
          <Text style={styles.subheading}>Manage Devotional Songs & Karaoke Timing</Text>
        </View>

        {/* Existing Songs Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Current Songs in Firestore</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#a0522d" style={{ marginVertical: 20 }} />
          ) : songs.length === 0 ? (
            <Text style={styles.emptyText}>No songs found. Create one below.</Text>
          ) : (
            songs.map(song => (
              <View key={song.id} style={styles.songItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.songItemTitle}>{song.title}</Text>
                  <Text style={styles.songItemSub}>{song.id} · {song.artist} · {song.lines.length} lines</Text>
                </View>
                <View style={styles.songActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(song)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(song.id)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Form Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{isEditing ? 'Modify Song' : 'Create Song'}</Text>
          
          <Text style={styles.inputLabel}>Song Document ID (URL-friendly string, e.g. "aarti")</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputDisabled]}
            value={songId}
            onChangeText={setSongId}
            placeholder="e.g. aarti"
            editable={!isEditing}
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Shree Adinath Aarti"
          />

          <Text style={styles.inputLabel}>Artist / Tradition</Text>
          <TextInput
            style={styles.input}
            value={artist}
            onChangeText={setArtist}
            placeholder="e.g. Traditional"
          />

          <Text style={styles.inputLabel}>Audio URL (Firebase Storage link)</Text>
          <TextInput
            style={styles.input}
            value={audioUrl}
            onChangeText={setAudioUrl}
            placeholder="Paste MP3 download URL"
            autoCapitalize="none"
          />

          {Platform.OS === 'web' && (
            <View style={styles.uploadRow}>
              {uploading ? (
                <ActivityIndicator size="small" color="#a0522d" />
              ) : (
                <input
                  type="file"
                  accept="audio/mp3,audio/*"
                  onChange={handleWebFileSelect}
                  style={styles.webFileInput}
                />
              )}
              <Text style={styles.uploadHint}>Upload MP3 directly to Storage (Web)</Text>
            </View>
          )}

          {/* Lines Editor */}
          <View style={styles.linesEditorSection}>
            <Text style={styles.linesSectionTitle}>Lyrics & Timestamps Editor</Text>
            <Text style={styles.linesSectionHint}>
              Enter timestamps in milliseconds (e.g. 5000 = 5 seconds) to trigger karaoke tracking.
            </Text>

            {lines.map((line, idx) => (
              <View key={idx} style={styles.lineCard}>
                <View style={styles.lineCardHeader}>
                  <Text style={styles.lineNumText}>Line {idx + 1}</Text>
                  <TouchableOpacity style={styles.lineRemoveBtn} onPress={() => handleRemoveLine(idx)}>
                    <Text style={styles.lineRemoveText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.lineRowInput}>
                  <View style={{ width: 110 }}>
                    <Text style={styles.inputMicroLabel}>Timestamp (ms)</Text>
                    <TextInput
                      style={styles.inputCompact}
                      keyboardType="numeric"
                      value={line.timestamp_ms}
                      onChangeText={v => handleLineChange(idx, 'timestamp_ms', v)}
                      placeholder="e.g. 5000"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.inputMicroLabel}>Gujarati</Text>
                    <TextInput
                      style={styles.inputCompact}
                      value={line.gujarati}
                      onChangeText={v => handleLineChange(idx, 'gujarati', v)}
                      placeholder="Gujarati script"
                    />
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputMicroLabel}>English Transliteration</Text>
                  <TextInput
                    style={styles.inputCompact}
                    value={line.transliteration}
                    onChangeText={v => handleLineChange(idx, 'transliteration', v)}
                    placeholder="Transliterated phonetic text"
                  />
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputMicroLabel}>English Translation</Text>
                  <TextInput
                    style={styles.inputCompact}
                    value={line.translation_en}
                    onChangeText={v => handleLineChange(idx, 'translation_en', v)}
                    placeholder="English translation"
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addLineBtn} onPress={handleAddLine}>
              <Text style={styles.addLineText}>+ Add Timing Line</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Reset / Clear</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Song Details</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf8f5' },
  container: { flex: 1 },
  content: { padding: 20 },
  header: { marginBottom: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backText: { fontSize: 16, color: '#a0522d', fontWeight: '700' },
  heading: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subheading: { fontSize: 14, color: '#666', marginTop: 4 },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 },
  emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },

  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8dfd6',
  },
  songItemTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  songItemSub: { fontSize: 12, color: '#666', marginTop: 2 },
  songActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    backgroundColor: '#fffaf6',
    borderWidth: 1,
    borderColor: '#a0522d',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editBtnText: { color: '#a0522d', fontSize: 13, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#cc3333',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteBtnText: { color: '#cc3333', fontSize: 13, fontWeight: '600' },

  inputLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#fdfbfa',
    borderWidth: 1,
    borderColor: '#e2d8cd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  inputDisabled: {
    backgroundColor: '#eee',
    color: '#888',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#f9f6f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eae0d4',
  },
  webFileInput: {
    fontSize: 12,
  },
  uploadHint: { fontSize: 11, color: '#666', marginLeft: 10, flex: 1 },

  linesEditorSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8dfd6',
    paddingTop: 20,
  },
  linesSectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  linesSectionHint: { fontSize: 12, color: '#666', marginBottom: 14, lineHeight: 17 },

  lineCard: {
    backgroundColor: '#fdfbfa',
    borderWidth: 1,
    borderColor: '#eae0d4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  lineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lineNumText: { fontSize: 13, fontWeight: '800', color: '#a0522d' },
  lineRemoveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  lineRemoveText: { color: '#cc3333', fontSize: 12, fontWeight: '600' },

  lineRowInput: {
    flexDirection: 'row',
  },
  inputMicroLabel: { fontSize: 10, fontWeight: '700', color: '#888', marginBottom: 4 },
  inputCompact: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2d8cd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#1a1a1a',
  },

  addLineBtn: {
    borderWidth: 1.5,
    borderColor: '#a0522d',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#fffcf9',
  },
  addLineText: { color: '#a0522d', fontSize: 14, fontWeight: '700' },

  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 140,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
