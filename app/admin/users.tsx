import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  grantAdminRole,
  listUsersForAdmin,
  revokeAdminRole,
  type AdminUserRow,
} from '../../lib/firestore-admin';
import { isAdminRole } from '../../lib/user-roles';
import { useAuth } from '../../context/auth';

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', onPress: onConfirm },
  ]);
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsersForAdmin();
      if (data === null) {
        Alert.alert(
          'Cannot load users',
          'Start the backend (uvicorn) and ensure EXPO_PUBLIC_API_URL points to it.'
        );
        setRows([]);
      } else {
        setRows(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Cannot load users', msg);
      setRows([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const applyRoleChange = async (row: AdminUserRow, grant: boolean) => {
    setUpdatingUid(row.uid);
    try {
      const ok = grant ? await grantAdminRole(row.uid) : await revokeAdminRole(row.uid);
      if (!ok) {
        Alert.alert(
          'Failed',
          'Could not update roles. Start the backend:\ncd backend && uvicorn main:app --reload --host 0.0.0.0'
        );
        return;
      }
      await load();
    } finally {
      setUpdatingUid(null);
    }
  };

  const onToggleAdmin = (row: AdminUserRow) => {
    const admin = isAdminRole(row.roles);
    const title = admin ? 'Revoke admin?' : 'Grant admin?';
    const message = `${row.displayName || row.email}\n\n${
      admin
        ? 'They will lose access to manage sutras and users.'
        : 'They can open the admin portal after triple-tapping the logo on sign-in.'
    }`;
    confirmAction(title, message, () => {
      void applyRoleChange(row, !admin);
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Tap a user row or the button on the right to grant or revoke admin access.
      </Text>
      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#a0522d" />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={rows}
          keyExtractor={item => item.uid}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          renderItem={({ item }) => {
            const admin = isAdminRole(item.roles);
            const self = item.uid === user?.uid;
            const busy = updatingUid === item.uid;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && !self && styles.rowPressed,
                ]}
                onPress={() => {
                  if (!self && !busy) onToggleAdmin(item);
                }}
                disabled={self || busy}
                accessibilityRole="button"
                accessibilityLabel={
                  self
                    ? 'Your account'
                    : admin
                    ? `Revoke admin from ${item.displayName}`
                    : `Grant admin to ${item.displayName}`
                }
              >
                <View style={styles.rowBody} pointerEvents="none">
                  <Text style={styles.name}>{item.displayName || '—'}</Text>
                  <Text style={styles.email}>{item.email || item.uid}</Text>
                  <Text style={styles.roles}>
                    {item.roles.join(', ')}
                    {self ? ' (you)' : ''}
                  </Text>
                </View>

                {self ? (
                  <Text style={styles.selfNote}>You</Text>
                ) : (
                  <View
                    style={[
                      styles.actionBtn,
                      admin ? styles.actionBtnAdmin : styles.actionBtnGrant,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={admin ? '#fff' : '#a0522d'} />
                    ) : (
                      <Text
                        style={[styles.actionBtnText, admin && styles.actionBtnTextOn]}
                        numberOfLines={2}
                      >
                        {admin ? 'Revoke\nadmin' : 'Make\nadmin'}
                      </Text>
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No users in Firestore yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  hint: { fontSize: 13, color: '#666', padding: 16, lineHeight: 20 },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    paddingRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    minHeight: 76,
  },
  rowPressed: { backgroundColor: '#faf6f3', borderColor: '#d4a574' },
  rowBody: { flex: 1, flexShrink: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  roles: { fontSize: 12, color: '#a0522d', marginTop: 4 },
  actionBtn: {
    minWidth: 88,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  actionBtnGrant: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#a0522d',
  },
  actionBtnAdmin: {
    backgroundColor: '#a0522d',
    borderWidth: 2,
    borderColor: '#a0522d',
  },
  actionBtnText: {
    color: '#a0522d',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtnTextOn: { color: '#fff' },
  selfNote: { fontSize: 12, color: '#999', flexShrink: 0, paddingHorizontal: 8 },
  empty: { textAlign: 'center', color: '#888', padding: 32 },
});
