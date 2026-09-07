import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';

/**
 * Authenticated placeholder home screen -- Day 2 only needs to prove the
 * authenticated state renders and sign-out works; the real Home experience
 * is a later V1 day's scope.
 */
export function HomeScreen() {
  const { user, signOut } = useAuth();

  const displayLabel = user?.displayName || user?.email || user?.phoneNumber || 'Member';

  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Welcome, {displayLabel}</Text>
      <Text style={styles.subtitle}>Day 2 foundation — home screen is a placeholder</Text>
      <Button title="Sign out" onPress={() => void signOut()} testID="sign-out-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
});
