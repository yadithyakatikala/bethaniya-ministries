import { StyleSheet, Text, View } from 'react-native';
import { AppButton, Icon, Sheet, Tappable, useTheme } from '../../../theme';
import type { IconName } from '../../../theme';
import { fontFamilies } from '../../../theme/tokens';
import { useTranslation, type StringKey } from '../../../i18n';
import type { HighlightColor } from '../../../theme/tokens';
import type { VerseAnnotation } from './useVerseAnnotations';

/**
 * The four highlight colours, each with the key that NAMES it.
 *
 * Naming them is not decoration. The four tints sit at the same
 * lightness by design so a highlighted page keeps its rhythm (see
 * ../../../theme/tokens.ts), which means hue is the only thing telling
 * them apart -- and hue alone is not available to every reader. Every
 * swatch therefore carries its colour's name as a visible label and as
 * its accessibility label.
 */
const HIGHLIGHT_CHOICES: { colour: HighlightColor; key: StringKey }[] = [
  { colour: 'yellow', key: 'bible.highlightYellow' },
  { colour: 'green', key: 'bible.highlightGreen' },
  { colour: 'blue', key: 'bible.highlightBlue' },
  { colour: 'pink', key: 'bible.highlightPink' },
];

/**
 * What you can do to the verse you just tapped.
 *
 * DELIBERATELY SHORT. The brief's rule is not to put a giant menu
 * between the reader and the page, so this is one sheet: the verse's reference
 * as its title; four named highlight colours (the one in force ringed, and a
 * plain "Remove highlight" beneath when there is one); then four rows --
 * Bookmark, Add note, Share, Copy -- each an icon and its word. No submenus,
 * no tabs, no scrolling on a normal phone.
 *
 * SIGNED OUT still gets Share and Copy -- neither needs an account --
 * and one sentence saying what signing in would add. Offering
 * Highlight/Bookmark/Note buttons that could only fail would be worse
 * than not offering them.
 */
export function VerseActionSheet({
  visible,
  onClose,
  reference,
  annotation,
  canAnnotate,
  onSelectHighlight,
  onToggleBookmark,
  onEditNote,
  onShare,
  onCopy,
}: {
  visible: boolean;
  onClose: () => void;
  /** "John 3:16", already localized by the caller. */
  reference: string;
  annotation: VerseAnnotation;
  canAnnotate: boolean;
  /** null clears the highlight. */
  onSelectHighlight: (colour: HighlightColor | null) => void;
  onToggleBookmark: () => void;
  onEditNote: () => void;
  onShare: () => void;
  onCopy: () => void;
}) {
  const { colors, highlights, type } = useTheme();
  const { t } = useTranslation();

  const row = (
    testID: string,
    icon: IconName,
    label: string,
    onPress: () => void,
    filled = false
  ) => (
    <Tappable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, { borderTopColor: colors.border }]}
    >
      <Icon name={icon} size={22} filled={filled} />
      <Text style={[styles.actionLabel, { color: colors.ink }]}>{label}</Text>
    </Tappable>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={reference}
      closeLabel={t('common.close')}
      testID="verse-action-sheet"
      scroll={false}
    >
      {canAnnotate ? (
        <View style={styles.highlight}>
          <Text
            accessibilityRole="header"
            style={[type.overline, { color: colors.inkMuted }]}
          >
            {t('bible.highlight')}
          </Text>
          <View style={styles.swatchRow} accessibilityRole="radiogroup">
            {HIGHLIGHT_CHOICES.map(({ colour, key }) => {
              const active = annotation.highlight === colour;
              return (
                <Tappable
                  key={colour}
                  testID={`highlight-${colour}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(key)}
                  onPress={() => onSelectHighlight(active ? null : colour)}
                  style={[
                    styles.swatch,
                    active ? styles.swatchActive : styles.swatchIdle,
                    {
                      backgroundColor: highlights[colour],
                      // The one in force is ringed in the heavy ink, as a chosen
                      // pill is everywhere else in the app: a ring, and not
                      // only a hue, says which.
                      borderColor: active ? colors.ink : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.swatchLabel, { color: colors.ink }]}
                    numberOfLines={1}
                  >
                    {t(key)}
                  </Text>
                </Tappable>
              );
            })}
          </View>
          {annotation.highlight ? (
            <View style={styles.remove}>
              <AppButton
                title={t('bible.removeHighlight')}
                variant="text"
                testID="remove-highlight-button"
                onPress={() => onSelectHighlight(null)}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <Text
          style={[type.bodySmall, { color: colors.inkMuted }]}
          testID="verse-actions-sign-in"
        >
          {t('bible.signInToSave')}
        </Text>
      )}

      <View style={styles.actions}>
        {canAnnotate
          ? [
              row(
                'bookmark-button',
                'bookmark',
                annotation.bookmarked ? t('bible.removeBookmark') : t('bible.bookmark'),
                onToggleBookmark,
                annotation.bookmarked
              ),
              row(
                'note-button',
                'note',
                annotation.note ? t('bible.editNote') : t('bible.addNote'),
                onEditNote
              ),
            ]
          : null}
        {row('share-verse-button', 'share', t('bible.share'), onShare)}
        {row('copy-verse-button', 'copy', t('bible.copy'), onCopy)}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  highlight: { gap: 8 },
  // Wraps rather than shrinking: "ఆకుపచ్చ" is wider than "Green", and
  // squeezing a colour's name until it clips is exactly what naming it
  // was meant to avoid.
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The 2pt ring of the chosen one takes a point of padding from each side, so
  // no chip changes size when it is chosen.
  swatchIdle: { borderWidth: 1, paddingHorizontal: 16 },
  swatchActive: { borderWidth: 2, paddingHorizontal: 15 },
  swatchLabel: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
  },
  remove: { alignSelf: 'flex-start', marginLeft: -12 },
  actions: { marginTop: -4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 52,
    borderTopWidth: 1,
  },
  actionLabel: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
  },
});
