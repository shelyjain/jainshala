import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../context/auth';
import { useProgress } from '../../hooks/use-progress';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { completed } = useProgress();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Account</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user?.displayName || 'Learner'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsEmoji}>🏅</Text>
        <Text style={styles.statsBigNumber}>{completed.length}</Text>
        <Text style={styles.statsSubtitle}>Badges Earned</Text>
        <Text style={styles.statsDetail}>Keep learning to earn more!</Text>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60 },
  heading: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', marginBottom: 28 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fdf8f4',
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e8d5c4',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#a0522d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 30, color: '#fff', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#888' },
  statsCard: {
    backgroundColor: '#fdf8f4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#a0522d',
  },
  statsEmoji: { fontSize: 36, marginBottom: 8 },
  statsBigNumber: { fontSize: 48, fontWeight: '800', color: '#a0522d', marginBottom: 4 },
  statsSubtitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  statsDetail: { fontSize: 13, color: '#888' },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: '#cc3333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#cc3333', fontSize: 16, fontWeight: '600' },
});
