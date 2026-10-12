import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './iconShapes';
import { Tappable } from './Tappable';
import { useTheme } from '../useTheme';

/**
 * The one shared ROW: the app's list item, with no box around it.
 *
 * Rows before cards. A list of ordinary things (settings, requests, posts,
 * saved items) is rows between hairlines; a card is for something
 * tappable and separate, such as a media post. This is the same row the
 * old More, Settings and Community screens drew inside boxes, without
 * the box.
 *
 *   64 high for two lines, 56 for one; 12 above and below; a hairline
 *   under every row but the last (the group draws them -- see ListGroup).
 *   Leading: a 40 icon circle, a 56 thumbnail (12 radius) or nothing.
 *   Trailing: a chevron; or a value, then a chevron; or your own node.
 *
 * ONE BUTTON. When it can be pressed the whole row is a single control,
 * and its spoken label joins the title and the subtitle; a value is read
 * after the title ("Theme, System").
 */
export function ListRow({
  title,
  subtitle,
  leadingIcon,
  thumbnail,
  value,
  trailing,
  chevron,
  onPress,
  destructive = false,
  testID,
  accessibilityHint,
  titleLines = 2,
  subtitleLines = 2,
}: {
  title: string;
  subtitle?: string;
  /** A 40 circle with this glyph. */
  leadingIcon?: IconName;
  /** A 56 thumbnail (12 radius). */
  thumbnail?: ImageSourcePropType;
  /** Shown on the right, before the chevron: "English", "System". */
  value?: string;
  /** Your own trailing node (a switch, a badge). Replaces the value and chevron. */
  trailing?: ReactNode;
  /** Defaults to true when the row can be pressed and has no `trailing` -- and to
   *  false for a destructive row ("Log out" does not "open" anything). */
  chevron?: boolean;
  onPress?: () => void;
  /** The title in the error colour: "Log out". */
  destructive?: boolean;
  testID?: string;
  accessibilityHint?: string;
  titleLines?: number;
  /** Raise it for a sentence that must not be cut ("Does not change the Bible."). */
  subtitleLines?: number;
}) {
  const { colors, radii, type, layout } = useTheme();
  const showChevron = trailing ? false : (chevron ?? (Boolean(onPress) && !destructive));
  const spoken = [title, value, subtitle].filter(Boolean).join(', ');

  const content = (
    <View
      style={[
        styles.row,
        { minHeight: subtitle ? layout.rowTwoLines : layout.rowOneLine },
      ]}
    >
      {leadingIcon ? (
        <View
          style={[styles.icon, { borderColor: colors.border, borderRadius: radii.pill }]}
        >
          <Icon name={leadingIcon} size={22} color={colors.ink} />
        </View>
      ) : null}
      {thumbnail ? (
        <Image
          source={thumbnail}
          accessibilityIgnoresInvertColors
          style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]}
        />
      ) : null}
      <View style={styles.text}>
        <Text
          style={[type.button, { color: destructive ? colors.danger : colors.ink }]}
          numberOfLines={titleLines}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[type.bodySmall, { color: colors.inkMuted }]}
            numberOfLines={subtitleLines}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <View style={styles.end}>
          {value ? (
            <Text style={[type.body, { color: colors.inkMuted }]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {showChevron ? <Icon name="chev" size={20} color={colors.inkMuted} /> : null}
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={spoken}>
        {content}
      </View>
    );
  }
  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({
        // Pressed: the wash fills the row edge to edge.
        backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
      })}
    >
      {content}
    </Tappable>
  );
}

/**
 * Rows between hairlines. Pass `ListRow`s (or anything) as children; a
 * hairline is drawn between each, none above the first or below the last.
 * `inset` indents the hairline past a leading icon or thumbnail.
 */
export function ListGroup({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  return (
    <View testID={testID}>
      {rows.map((child, index) => (
        <View
          key={index}
          style={index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  icon: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    maxWidth: '45%',
  },
});
