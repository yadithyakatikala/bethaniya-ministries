import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PLACEHOLDER_VERSES } from './placeholderData';

/**
 * Bible screen -- Day 1/corrections scope.
 *
 * Renders synthetic placeholder verses only; see /BIBLE_LICENSING.md for
 * why, and mobile/src/features/bible/placeholderData.ts for the data
 * itself. This screen is not yet wired into app navigation (no navigation
 * library is set up yet) -- it exists so the Bible module's data shape and
 * a basic list UI can be built and tested now.
 */
export function BibleScreen() {
  return (
    <ScrollView style={styles.container} testID="bible-screen">
      <View style={styles.banner} testID="bible-placeholder-banner">
        <Text style={styles.bannerText}>
          Development content — not a real Bible translation
        </Text>
      </View>
      {PLACEHOLDER_VERSES.map((verse) => (
        <View key={verse.id} style={styles.verseRow}>
          <Text style={styles.reference}>{verse.reference}</Text>
          <Text style={styles.verseText}>{verse.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  banner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
  },
  bannerText: {
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  verseRow: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  reference: {
    fontWeight: '600',
    marginBottom: 4,
  },
  verseText: {
    color: '#374151',
  },
});
