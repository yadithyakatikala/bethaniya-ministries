import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { AppStateProvider } from './src/context/AppStateContext';

/**
 * Root component — Day 1 foundation placeholder.
 *
 * This intentionally does NOT implement the real "Maranatha" splash screen,
 * navigation, or auth flow yet (see project instructions: Day 1 is foundation
 * only). It exists to prove the scaffold builds, runs, and is wired to the
 * app-wide context provider that later screens will consume.
 */
export default function App() {
  return (
    <AppStateProvider>
      <View style={styles.container}>
        <Text style={styles.title}>Bethaniya Ministries</Text>
        <Text style={styles.subtitle}>Day 1 foundation — under construction</Text>
        <StatusBar style="auto" />
      </View>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});
