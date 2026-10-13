import { Image, type StyleProp, type ImageStyle } from 'react-native';

const PORTRAIT = require('../../../assets/brand/maranatha-portrait-crop-512.jpg');

/**
 * The round portrait the opening ends on, as a mark: 96 across on the loading
 * screen, 72 on the sign-in screen and 44 when the keyboard is up.
 *
 * It is the same bundled picture the opening shows (a 512-point crop, so it is
 * sharp at three times 96), cut to a circle by its own border radius. It is
 * decoration -- the word MARANATHA beside it, or the screen's title, is what
 * names the app -- so it is hidden from a screen reader and, being a
 * photograph, is exempt from colour inversion.
 */
export function BrandPortrait({
  size,
  testID,
  style,
}: {
  size: number;
  testID?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      testID={testID}
      source={PORTRAIT}
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}
