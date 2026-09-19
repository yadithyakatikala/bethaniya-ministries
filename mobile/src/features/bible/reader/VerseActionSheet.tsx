import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../../theme/ui/Sheet';
import { AppButton } from '../../../theme/ui/AppButton';
import { Tappable } from '../../../theme/ui/Tappable';
import { Divider } from '../../../theme/ui/Divider';
import { useTheme } from '../../../theme';
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
 * between the reader and the page, so this is one sheet: a row of named
 * highlight colours, then five actions, then nothing. No submenus, no
 * tabs, no scrolling on a normal phone.
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
  const { colors, radii, spacing, type, highlights, minTouchTarget } = useTheme();
  const { t } = useTranslation();

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
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: colors.inkMuted }]}>
            {t('bible.highlight')}
          </Text>
          <View style={styles.swatchRow}>
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
                    {
                      minHeight: minTouchTarget,
                      borderRadius: radii.control,
                      backgroundColor: highlights[colour],
                      // The selected swatch is ringed in `primary`, which
                      // clears 3:1 on all four tints in both palettes --
                      // `borderStrong` does not on the lighter ones.
                      borderColor: active ? colors.primary : colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[type.caption, { color: colors.ink }]} numberOfLines={1}>
                    {t(key)}
                  </Text>
                </Tappable>
              );
            })}
          </View>
          {annotation.highlight ? (
            <AppButton
              title={t('bible.removeHighlight')}
              variant="text"
              testID="remove-highlight-button"
              onPress={() => onSelectHighlight(null)}
            />
          ) : null}

          <Divider />
          <View style={styles.actionGrid}>
            <View style={styles.actionCell}>
              <AppButton
                title={
                  annotation.bookmarked ? t('bible.removeBookmark') : t('bible.bookmark')
                }
                variant="secondary"
                fullWidth
                testID="bookmark-button"
                onPress={onToggleBookmark}
              />
            </View>
            <View style={styles.actionCell}>
              <AppButton
                title={annotation.note ? t('bible.editNote') : t('bible.addNote')}
                variant="secondary"
                fullWidth
                testID="note-button"
                onPress={onEditNote}
              />
            </View>
          </View>
        </View>
      ) : (
        <Text
          style={[type.bodySmall, { color: colors.inkMuted }]}
          testID="verse-actions-sign-in"
        >
          {t('bible.signInToSave')}
        </Text>
      )}

      <View style={styles.actionGrid}>
        <View style={styles.actionCell}>
          <AppButton
            title={t('bible.share')}
            variant="secondary"
            fullWidth
            testID="share-verse-button"
            onPress={onShare}
          />
        </View>
        <View style={styles.actionCell}>
          <AppButton
            title={t('bible.copy')}
            variant="secondary"
            fullWidth
            testID="copy-verse-button"
            onPress={onCopy}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Wraps rather than shrinking: "ఆకుపచ్చ" is wider than "Green", and
  // squeezing a colour's name until it clips is exactly what naming it
  // was meant to avoid.
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 10 },
  actionCell: { flex: 1 },
});
