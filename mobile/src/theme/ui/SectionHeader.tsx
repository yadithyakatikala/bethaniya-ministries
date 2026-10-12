import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from './Tappable';
import { onPhoto } from '../tokens';
import { useTheme } from '../useTheme';

/**
 * A tracked uppercase label above a group, with an optional "See all".
 *
 * The title is the `overline` role: muted ink, or gold ink (`tone="gold"`)
 * for the one label a screen wants to carry the brand -- "Verse of the day".
 * Gold stays small text here, never a fill. `tone="photo"` is white, for a
 * label set over a photograph (see ../tokens.ts's `onPhoto`).
 *
 * THE ACTION is a text link, flush with the right margin so its word lines
 * up with the content under it, 14/18 semibold in gold ink. It is a REAL
 * 44-point target (a row 44 high, 44 wide at least): `hitSlop` widens where
 * a tap lands but not where a screen reader or a switch-control user finds
 * the element, and an extension of a child beyond its parent's frame does
 * not receive touches on Android at all. A row with an action is therefore
 * 44 high with the label centred in it, and a screen that wants a section
 * gap to LOOK like 32 takes the 14 above the label out of its own margin.
 * Its spoken name carries the section ("See all, Upcoming events"), because
 * a screen with two "See all" links is otherwise two identical buttons.
 *
 * The title keeps `flexShrink` and the action `flexShrink: 0`, so a long
 * Telugu section name wraps instead of pushing "See all" off the edge.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  tone = 'muted',
  testID,
  actionTestID,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'muted' | 'gold' | 'photo';
  testID?: string;
  actionTestID?: string;
}) {
  const { colors, layout, type } = useTheme();
  const hasAction = Boolean(actionLabel && onAction);
  const titleInk =
    tone === 'gold' ? colors.accent : tone === 'photo' ? onPhoto.ink : colors.inkMuted;
  const actionInk = tone === 'photo' ? onPhoto.ink : colors.accent;
  return (
    <View style={[styles.row, hasAction && { minHeight: layout.hit }]} testID={testID}>
      <Text
        style={[type.overline, styles.title, { color: titleInk }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {hasAction ? (
        <Tappable
          testID={actionTestID}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          onPress={onAction}
          style={[styles.action, { minHeight: layout.hit, minWidth: layout.hit }]}
        >
          <Text style={[type.label, { color: actionInk }]} numberOfLines={2}>
            {actionLabel}
          </Text>
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flexShrink: 1 },
  // Flush right: the word sits at the margin; the 12 on its left is target.
  action: {
    flexShrink: 0,
    paddingLeft: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
