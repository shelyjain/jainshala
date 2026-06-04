import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { isAdminPortalUnlocked } from '../../lib/admin-unlock';
import { useRouter } from 'expo-router';
import { AdminLogoTap } from '@/components/admin-logo-tap';
import { useAuth } from '../../context/auth';
import { useGoogleSignIn } from '../../hooks/use-google-sign-in';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { firebaseAuthErrorMessage, isAuthCancellation, showUserAlert } from '../../lib/user-alert';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const { signIn, syncUserProfile } = useAuth();

  useEffect(() => {
    void isAdminPortalUnlocked().then(v => {
      if (v) setAdminUnlocked(true);
    });
  }, []);
  const { signInWithGoogle, ready: googleReady } = useGoogleSignIn();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      const msg =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : err.code === 'auth/user-not-found'
          ? 'No account found with this email.'
          : 'Sign in failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const credential = await signInWithGoogle();
      const synced = await syncUserProfile(credential.user);
      if (!synced) {
        showUserAlert(
          'Signed in',
          'Google sign-in worked, but cloud sync is blocked. In Firebase Console → Firestore → Rules, publish the rules from firestore.rules in this project, then try again.',
        );
      }
    } catch (err: unknown) {
      if (!isAuthCancellation(err)) {
        showUserAlert('Google sign-in failed', firebaseAuthErrorMessage(err, 'Google sign-in failed.'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <AdminLogoTap
            size={96}
            onUnlocked={() => {
              setAdminUnlocked(true);
            }}
          />
        </View>
        <Text style={styles.heading}>Jain Shala</Text>
        <Text style={styles.subheading}>Sign in to sync your progress</Text>

        <GoogleSignInButton
          onPress={handleGoogleSignIn}
          loading={googleLoading}
          disabled={!googleReady}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>

        {adminUnlocked ? (
          <TouchableOpacity onPress={() => router.push('/admin')} style={styles.adminLinkWrap}>
            <Text style={styles.adminLink}>Admin portal</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 16 },
  adminLinkWrap: { marginTop: 20, alignItems: 'center' },
  adminLink: {
    color: '#a0522d',
    fontWeight: '700',
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e8e8e8' },
  dividerText: { fontSize: 13, color: '#999', fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 6 },
  subheading: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  btn: {
    backgroundColor: '#a0522d',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#888', fontSize: 14 },
  linkBold: { color: '#a0522d', fontWeight: '600' },
});
