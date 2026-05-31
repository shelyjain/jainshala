import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

type GoogleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function GoogleSignInButton({
  onPress,
  disabled,
  loading,
  label = 'Continue with Google',
}: GoogleSignInButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#1a1a1a" />
      ) : (
        <>
          <Text style={styles.icon}>G</Text>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  icon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
