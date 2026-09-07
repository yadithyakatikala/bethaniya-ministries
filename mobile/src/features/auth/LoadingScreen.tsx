import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/** Shown while AuthContext hasn't yet received Firebase's initial auth state. */
export function LoadingScreen() {
  return (
    <View style={styles.container} testID="auth-loading-screen">
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 14, color: '#666' },
});
