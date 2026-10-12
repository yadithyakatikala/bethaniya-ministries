import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Tappable } from '../../../theme/ui/Tappable';
import { GoldBar } from '../../../theme/ui/GoldLine';
import { Icon } from '../../../theme/ui/Icon';
import { useTheme } from '../../../theme';
import { serifFor } from '../../../theme/tokens';
import { useTranslation } from '../../../i18n';
import { usePreferences } from '../../../context/PreferencesContext';
import { useSavedReadingPosition } from './useSavedReadingPosition';
import { getBookNameById } from '../books';
import { bookNameLanguageFor } from '../types';

/**
 * "Continue reading" -- the saved reading position, offered rather than
 * imposed: a thin gold bar, a quiet label, the book and chapter in the
 * serif, a chevron.
 *
 * WHY IT IS HERE AND NOT IN THE READER. The reader always opens the book
 * and chapter it was navigated to: explicit navigation wins, and a
 * screen that silently redirected you somewhere else would be a bug, not
 * a feature. So the saved position is an ENTRY POINT -- on Home, and at the
 * top of the Bible -- which is where someone who just opened the app
 * actually looks for it.
 *
 * Renders nothing at all while signed out, or before the member has read
 * anything in the current translation -- an empty "Continue reading"
 * card is worse than no card. One document read per translation, and
 * only while this screen is mounted.
 *
 * The book's name is the app's own text, in a script it knows, so it takes
 * that script's serif (21/28; Telugu 19/32 with the room its marks need).
 */
export function ContinueReading({
  onOpen,
  style,
}: {
  onOpen: (bookId: string, chapter: number, verse: number) => void;
  /**
   * The row's OWN outer style -- a margin, say. It lives on the row rather
   * than on a wrapper the caller draws, so that when there is nothing to
   * continue (and this renders nothing) no empty margin is left behind.
   */
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage, bibleMode } = usePreferences();
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  const position = useSavedReadingPosition();

  const bookName = position
    ? getBookNameById(position.bookId, bookNameLanguage)
    : undefined;
  if (!position || !bookName) return null;

  const telugu = bookNameLanguage === 'te';

  return (
    <Tappable
      testID="continue-reading-button"
      accessibilityRole="button"
      accessibilityLabel={`${t('bible.continueReading')}. ${bookName} ${position.chapter}`}
      onPress={() => onOpen(position.bookId, position.chapter, position.verse)}
      style={[styles.row, { minHeight: layout.rowTwoLines }, style]}
    >
      <GoldBar width={3} />
      <View style={styles.text}>
        <Text style={[type.overline, { color: colors.inkMuted }]}>
          {t('bible.continueReading')}
        </Text>
        <Text
          style={[
            styles.book,
            {
              color: colors.ink,
              fontFamily: serifFor(telugu ? 'te' : 'en', 'semiBold'),
              fontSize: telugu ? 19 : 21,
              lineHeight: telugu ? 32 : 28,
            },
          ]}
          numberOfLines={2}
        >
          {`${bookName} ${position.chapter}`}
        </Text>
      </View>
      <Icon name="chev" size={20} color={colors.inkMuted} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  book: { fontWeight: '600' },
});
