import { StyleSheet, Text, View } from 'react-native';
import { GoldBar, Icon, contentTextStyle, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/**
 * The play marker over a video's poster: a round disc in the primary ink with
 * the play triangle in the on-primary colour. `primary` and `onPrimary` rather
 * than a hard-coded black disc, because primary inverts between the palettes,
 * so the marker stays readable over a bright photograph and a dark one.
 */
export function PlayMarker({
  size = 56,
  testID,
  label,
}: {
  size?: number;
  testID?: string;
  /** Spoken, when the marker is the whole of what says "this is a video". */
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Icon name="play" size={Math.round(size / 2)} color={colors.onPrimary} />
    </View>
  );
}

/**
 * The verse a post carries: a thin gold bar, the words, and the reference
 * beneath in gold ink.
 *
 * The words are set in the serif of THEIR script (one script takes its serif,
 * mixed text takes the interface family -- see ../../theme/scriptFace.ts): an
 * administrator typed them, and a post may quote either Bible, or both in one
 * sentence.
 */
export function PostVerse({
  text,
  reference,
  testID,
  size = 16,
  line = 25,
}: {
  /** Either may be absent: a post can carry a reference without the words, or the words without a reference. */
  text: string | null;
  reference: string | null;
  testID?: string;
  size?: number;
  line?: number;
}) {
  const { colors, type } = useTheme();
  const { appLanguage } = useTranslation();
  return (
    <View testID={testID} style={styles.verse}>
      <GoldBar width={2} />
      <View style={styles.verseBody}>
        {text ? (
          <Text
            style={[
              contentTextStyle(text, {
                size,
                line,
                teSize: size,
                teLine: Math.round(line * 1.2),
                fallback: appLanguage,
              }),
              { color: colors.ink },
            ]}
          >
            {text}
          </Text>
        ) : null}
        {reference ? (
          <Text style={[type.scriptureReference, { color: colors.accent }]}>
            {reference}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { alignItems: 'center', justifyContent: 'center' },
  verse: { flexDirection: 'row', gap: 14, paddingVertical: 2 },
  verseBody: { flex: 1, minWidth: 0, gap: 3 },
});
