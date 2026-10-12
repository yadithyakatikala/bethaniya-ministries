import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Icon, useTheme } from '../../theme';

/**
 * A song's picture: the cover the church attached, when there is one and it
 * loads; otherwise a quiet tile with a music note on it.
 *
 * The covers are links the church typed in (nothing is uploaded -- Storage is
 * off), so a dead link is an ordinary thing. A cover that fails to load falls
 * back to the tile rather than leaving a hole, and a new link gets a fresh
 * try (the failure is remembered against the link, not the screen).
 *
 * Square. `size` and `radius` come from where it is drawn: 56 and 12 in the
 * list, 196 and 16 on the song's own page. It is decoration -- the title beside
 * it names the song -- so a screen reader skips it.
 */
export function SongCover({
  uri,
  size,
  radius,
  glyphSize,
  testID,
}: {
  uri: string | null;
  size: number;
  radius: number;
  /** The note on the tile. */
  glyphSize: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showPicture = Boolean(uri) && failedUri !== uri;

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cover,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.surfaceRaised,
        },
      ]}
    >
      {showPicture ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Icon name="music" size={glyphSize} color={colors.inkMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
