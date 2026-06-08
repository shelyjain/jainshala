import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/auth';
import { useUserProfile } from '../../hooks/use-user-profile';
import { isAdminPortalUnlocked } from '../../lib/admin-unlock';

export default function AdminHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin, loading: profileLoading, roles, permissionDenied, refresh } = useUserProfile();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    void isAdminPortalUnlocked().then(setUnlocked);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (unlocked === null || profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#a0522d" />
      </View>
    );
  }

  if (!unlocked) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Admin locked</Text>
        <Text style={styles.body}>
          Triple-tap the Jain Shala logo on the sign-in or sign-up screen to unlock the admin portal.
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Sign in required</Text>
        <Text style={styles.body}>Sign in with an admin-approved account to continue.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.btnText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>
          {permissionDenied ? 'Cannot load profile' : 'Awaiting approval'}
        </Text>
        <Text style={styles.email}>Signed in as: {user.email ?? user.uid}</Text>
        {!permissionDenied ? (
          <Text style={styles.body}>
            Your roles in Firestore: {roles.length > 0 ? roles.join(', ') : '(none — user only)'}
            {'\n\n'}
            Admin is granted for mj801054@gmail.com in the database. Sign in with that exact account,
            then tap Refresh below.
          </Text>
        ) : (
          <Text style={styles.body}>
            Firestore blocked reading your profile. Deploy the latest rules:{'\n'}
            firebase deploy --only firestore:rules
          </Text>
        )}
        <TouchableOpacity style={styles.btn} onPress={refresh}>
          <Text style={styles.btnText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.btnSecondaryText}>Back to app</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user.displayName || user.email}</Text>
      <Text style={styles.sub}>Manage catalog and learners</Text>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/sutras')}>
        <Text style={styles.cardTitle}>Sutras</Text>
        <Text style={styles.cardBody}>Upload, edit, and assign badges</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/users')}>
        <Text style={styles.cardTitle}>Users & roles</Text>
        <Text style={styles.cardBody}>Approve admin access for learners</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnSecondaryText}>Return to Jain Shala</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fafafa' },
  centered: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  email: {
    fontSize: 14,
    color: '#a0522d',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: { fontSize: 15, color: '#666', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  welcome: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#a0522d', marginBottom: 4 },
  cardBody: { fontSize: 14, color: '#666' },
  btn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSecondary: { marginTop: 24, padding: 14, alignItems: 'center' },
  btnSecondaryText: { color: '#a0522d', fontWeight: '600', fontSize: 15 },
});
