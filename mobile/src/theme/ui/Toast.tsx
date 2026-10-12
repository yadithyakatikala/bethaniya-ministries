import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../useTheme';

/** How long a confirmation stays up. Long enough to read, short enough to be out of the way. */
export const TOAST_MS = 3200;

/**
 * A confirmation that something worked: a pill in the primary ink with a
 * tick and a few words, floated above the content ("Your request was
 * shared").
 *
 * It takes no touches (`pointerEvents="none"`) -- it never covers a control
 * it is not meant to answer -- and it is a polite live region, so a screen
 * reader announces it without the member going looking. It is a CONFIRMATION
 * only: a failure is a `NoticeBanner`, which stays until it is dealt with.
 *
 * `bottom` is where it floats from the bottom of its container; the default
 * clears a floating action button.
 */
export function Toast({
  message,
  bottom = 88,
  testID = 'toast',
}: {
  /** Nothing is drawn while this is empty. */
  message: string | null;
  bottom?: number;
  testID?: string;
}) {
  const { colors, radii, type } = useTheme();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      <View
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.pill,
          { backgroundColor: colors.primary, borderRadius: radii.pill },
        ]}
      >
        <Icon name="check" size={18} color={colors.onPrimary} />
        <Text style={[type.label, { color: colors.onPrimary }]}>{message}</Text>
      </View>
    </View>
  );
}

/**
 * The state behind a `Toast`: `show("...")` raises it and it takes itself
 * down after TOAST_MS. A second `show` replaces the first and restarts the
 * clock; the timer is cleared if the screen goes away first.
 */
export function useToast(): { message: string | null; show: (text: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { message, show };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
