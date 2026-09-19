import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from '../../../theme/ui/Tappable';
import { ChevronIcon } from '../../../theme/ui/FeatureIcons';
import { useTheme, useTypographyFor } from '../../../theme';
import { useTranslation } from '../../../i18n';
import { useAuth } from '../../../context/AuthContext';
import { usePreferences } from '../../../context/PreferencesContext';
import { primaryBibleLanguage } from '../../../context/languagePreferences';
import {
  subscribeToReadingPosition,
  type ReadingPosition,
} from '../../../services/firebase/readingPosition';
import { getBookNameById } from '../books';
import { bookNameLanguageFor } from '../types';

/**
 * "Continue reading" -- the saved reading position, offered rather than
 * imposed.
 *
 * WHY IT IS HERE AND NOT IN THE READER. The reader always opens the book
 * and chapter it was navigated to: explicit navigation wins, and a
 * screen that silently redirected you somewhere else would be a bug, not
 * a feature. So the saved position is an ENTRY POINT on the Bible tab,
 * which is where someone who just opened the app actually looks for it.
 *
 * Renders nothing at all while signed out, or before the member has read
 * anything in the current translation -- an empty "Continue reading"
 * card is worse than no card. One document read per translation, and
 * only while this screen is mounted.
 */
export function ContinueReading({
  onOpen,
}: {
  onOpen: (bookId: string, chapter: number, verse: number) => void;
}) {
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { status, user } = useAuth();
  const { appLanguage, bibleMode } = usePreferences();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;
  const translationId = primaryBibleLanguage(bibleMode);
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  // The card names a BOOK, so its type follows the book name's script.
  const bookType = useTypographyFor(bookNameLanguage);

  const [saved, setSaved] = useState<ReadingPosition | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToReadingPosition(uid, translationId, setSaved, () => setSaved(null));
  }, [uid, translationId]);

  // DERIVED rather than cleared in an effect, so signing out hides the
  // card on the very next render instead of one frame later.
  const position = uid ? saved : null;

  const bookName = position
    ? getBookNameById(position.bookId, bookNameLanguage)
    : undefined;
  if (!position || !bookName) return null;

  return (
    <Tappable
      testID="continue-reading-button"
      accessibilityRole="button"
      accessibilityLabel={`${t('bible.continueReading')}. ${bookName} ${position.chapter}`}
      onPress={() => onOpen(position.bookId, position.chapter, position.verse)}
      style={[
        styles.card,
        {
          backgroundColor: colors.primaryTint,
          borderColor: colors.border,
          borderRadius: radii.card,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.text}>
        <Text style={[type.overline, { color: colors.inkMuted }]}>
          {t('bible.continueReading')}
        </Text>
        <Text style={[bookType.label, { color: colors.ink }]} numberOfLines={2}>
          {`${bookName} ${position.chapter}`}
        </Text>
      </View>
      <ChevronIcon color={colors.inkMuted} size={18} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
});
