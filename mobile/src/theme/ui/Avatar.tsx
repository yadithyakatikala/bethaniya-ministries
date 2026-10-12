import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../useTheme';
import { contentFontFamily } from '../scriptFace';

/**
 * The first letter of a name, with the marks that belong to it.
 *
 * Telugu letters carry vowel signs and the virama as combining marks, so
 * the first CODE POINT of "రూత్" ("ర") would drop the "ూ" that makes it the
 * syllable. This takes the first letter and the combining marks that
 * follow it. Empty or marks-only input gives "?" rather than nothing, so
 * an avatar is never blank.
 */
export function initialOf(name: string | null | undefined): string {
  const text = (name ?? '').trim();
  const match = text.match(/^\p{L}\p{M}*/u);
  if (!match) return text ? Array.from(text)[0].toUpperCase() : '?';
  return match[0].toUpperCase();
}

/**
 * A monogram: no photos anywhere in the app (the church's plan is the
 * free tier, where an upload cannot complete -- decision H6). It is a
 * wash disc with a hairline and an initial in the serif of its script,
 * from 26 up to 96 across.
 *
 * Decorative by default (the name is next to it, in words); pass `label`
 * when it stands alone as a button's content.
 */
export function Avatar({
  name,
  size = 40,
  label,
  testID,
}: {
  name: string | null | undefined;
  /** 26 to 96. */
  size?: number;
  label?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const initial = initialOf(name);
  return (
    <View
      testID={testID}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: colors.ink,
          fontFamily: contentFontFamily(initial, { weight: 'semiBold' }),
          fontSize: Math.round(size * 0.42),
          lineHeight: Math.round(size * 0.55),
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
