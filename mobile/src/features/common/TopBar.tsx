import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, IconButton, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/**
 * The top bar of a pushed screen: a round Back (or Close) button, a short
 * centred title, and room for one action at the right.
 *
 * The app draws this itself, in place of the platform header, so every
 * pushed screen has the same bar in both themes and both languages: 56 high,
 * the button's glyph lined up with the 20-point margin (a -10 shift of its
 * 44-point target), the title one line in the interface face (a long Telugu
 * title is cut with an ellipsis -- the full title is the screen's own
 * heading, further down). `variant="close"` is for a screen that is a task
 * rather than a place -- a new journal entry -- and says "Close".
 *
 * `onBack` is a prop rather than a call to useNavigation here, so a screen
 * decides what leaving means (a form may ask first), and a test needs no
 * navigator to draw the bar.
 *
 * The bar is a heading for a screen reader when it has a title.
 */
export function TopBar({
  title,
  onBack,
  variant = 'back',
  trailing,
  testID,
}: {
  title?: string;
  onBack: () => void;
  variant?: 'back' | 'close';
  /** One action at the right (44 across). Without one, a spacer keeps the title centred. */
  trailing?: ReactNode;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  const close = variant === 'close';
  return (
    <View style={styles.row} testID={testID}>
      <IconButton
        testID={testID ? `${testID}-back` : 'top-bar-back'}
        accessibilityLabel={close ? t('common.close') : t('common.back')}
        onPress={onBack}
      >
        <Icon name={close ? 'close' : 'back'} size={24} />
      </IconButton>
      <Text
        numberOfLines={1}
        accessibilityRole={title ? 'header' : undefined}
        style={[
          type.button,
          styles.title,
          { color: colors.ink, fontSize: 16, lineHeight: 22 },
        ]}
      >
        {title ?? ''}
      </Text>
      {trailing ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -10,
  },
  title: { flex: 1, minWidth: 0, textAlign: 'center', paddingHorizontal: 4 },
  spacer: { width: 44, height: 44 },
});
