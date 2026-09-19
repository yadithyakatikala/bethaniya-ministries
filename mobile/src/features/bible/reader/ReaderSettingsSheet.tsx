import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Sheet } from '../../../theme/ui/Sheet';
import { SegmentedChoice } from '../../../theme/ui/SegmentedChoice';
import { IconButton } from '../../../theme/ui/IconButton';
import { Divider } from '../../../theme/ui/Divider';
import { readingScale, scriptureStyle, useTheme } from '../../../theme';
import { useTranslation } from '../../../i18n';
import { usePreferences } from '../../../context/PreferencesContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import type {
  ReadingDensity,
  ReadingFont,
  ReadingMeasure,
  ReadingSize,
} from '../../../theme/tokens';
import type { ThemePreference } from '../../../services/firebase/userProfile';
import { SIDE_BY_SIDE_MIN_WIDTH } from './ScriptureBody';
import type { BilingualLayout } from '../alignment';
import type { BibleLanguage, BibleMode } from '../types';

/** Smallest to largest, so the -/+ buttons can step through them. */
const SIZE_STEPS = Object.keys(readingScale.size) as ReadingSize[];

/**
 * The reader's own settings.
 *
 * SIZE IS A STEPPER, the rest are named choices. Six size steps as six
 * chips would be a row of unreadable numbers; two 44dp buttons around a
 * live sample is how every reading app does it, and the sample is set in
 * the actual chosen face, size and leading so the choice is visible
 * before the sheet closes.
 *
 * THE THEME ROW WRITES THE APP'S ONE THEME PREFERENCE, not a
 * reader-local copy -- see
 * ../../../services/firebase/userProfile.ts's ThemePreference for why
 * there is only one. Choosing Dark here is the same choice as choosing
 * Dark in Settings, which is what a reader expects and what stops the
 * two screens disagreeing.
 *
 * The bilingual layout row only appears in bilingual mode. A control
 * for something the current mode cannot show is noise.
 */
export function ReaderSettingsSheet({
  visible,
  onClose,
  bilingual,
  sampleLanguage,
  sampleText,
}: {
  visible: boolean;
  onClose: () => void;
  bilingual: boolean;
  /** Which script the live sample is set in -- the Bible being read. */
  sampleLanguage: BibleLanguage;
  sampleText: string;
}) {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { themePreference, setThemePreference, bibleMode, setBibleMode } =
    usePreferences();
  const { font, size, lineHeight, width, layout, setReadingPrefs } =
    useReadingPreferences();
  const { width: screenWidth } = useWindowDimensions();
  // Side by side needs a tablet to be readable at all (see
  // ./ScriptureBody.tsx), so on a phone the row is not offered. A
  // control for something the device cannot show is noise -- the same
  // reason the row is absent outside bilingual mode.
  const canGoSideBySide = screenWidth >= SIDE_BY_SIDE_MIN_WIDTH;

  const sizeIndex = SIZE_STEPS.indexOf(size);

  function stepSize(delta: number) {
    const next = SIZE_STEPS[sizeIndex + delta];
    if (next) void setReadingPrefs({ size: next });
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('bible.readingSettings')}
      closeLabel={t('common.close')}
      testID="reader-settings-sheet"
    >
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>{t('bible.sizeLabel')}</Text>
        <View style={styles.stepperRow}>
          <IconButton
            variant="tinted"
            accessibilityLabel={t('bible.decreaseSize')}
            testID="reader-size-decrease"
            disabled={sizeIndex <= 0}
            onPress={() => stepSize(-1)}
          >
            <View style={[styles.bar, { backgroundColor: colors.ink }]} />
          </IconButton>
          {/* The sample is the control's real feedback: it is set with
              the same scriptureStyle() the page uses, in the script of
              the Bible being read, so Telugu leading is visible here
              too. */}
          <Text
            testID="reader-size-sample"
            numberOfLines={2}
            style={[
              scriptureStyle(sampleLanguage, size, lineHeight, font),
              styles.sample,
              { color: colors.ink },
            ]}
          >
            {sampleText}
          </Text>
          <IconButton
            variant="tinted"
            accessibilityLabel={t('bible.increaseSize')}
            testID="reader-size-increase"
            disabled={sizeIndex >= SIZE_STEPS.length - 1}
            onPress={() => stepSize(1)}
          >
            <View style={styles.plus}>
              <View style={[styles.bar, { backgroundColor: colors.ink }]} />
              <View
                style={[styles.bar, styles.barVertical, { backgroundColor: colors.ink }]}
              />
            </View>
          </IconButton>
        </View>
      </View>

      <Divider />
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>{t('bible.fontLabel')}</Text>
        <SegmentedChoice
          testID="reader-font"
          accessibilityLabel={t('bible.fontLabel')}
          options={[
            { value: 'serif' as ReadingFont, label: t('bible.fontSerif') },
            { value: 'sans' as ReadingFont, label: t('bible.fontSans') },
          ]}
          selected={font}
          onSelect={(value) => void setReadingPrefs({ font: value })}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>
          {t('bible.lineHeightLabel')}
        </Text>
        <SegmentedChoice
          testID="reader-line-height"
          accessibilityLabel={t('bible.lineHeightLabel')}
          options={[
            { value: 'compact' as ReadingDensity, label: t('bible.lineHeightCompact') },
            { value: 'normal' as ReadingDensity, label: t('bible.lineHeightNormal') },
            { value: 'relaxed' as ReadingDensity, label: t('bible.lineHeightRelaxed') },
          ]}
          selected={lineHeight}
          onSelect={(value) => void setReadingPrefs({ lineHeight: value })}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>{t('bible.widthLabel')}</Text>
        <SegmentedChoice
          testID="reader-width"
          accessibilityLabel={t('bible.widthLabel')}
          options={[
            { value: 'narrow' as ReadingMeasure, label: t('bible.widthNarrow') },
            { value: 'normal' as ReadingMeasure, label: t('bible.widthNormal') },
            { value: 'wide' as ReadingMeasure, label: t('bible.widthWide') },
          ]}
          selected={width}
          onSelect={(value) => void setReadingPrefs({ width: value })}
        />
      </View>

      <Divider />
      {/* WHICH BIBLE. The same `bibleMode` preference Settings owns, not a
          reader-local copy -- M2's whole point is that the Bible
          preference is independent of the interface language, and it must
          stay ONE value. This replaces the old reader's pill, which
          cycled the three modes blind; naming them is how someone picks
          the one they meant. */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>
          {t('settings.bibleLanguage')}
        </Text>
        <SegmentedChoice
          testID="reader-bible-mode"
          accessibilityLabel={t('settings.bibleLanguage')}
          options={[
            { value: 'te' as BibleMode, label: t('bible.modeTelugu') },
            { value: 'en' as BibleMode, label: t('bible.modeEnglish') },
            { value: 'bilingual' as BibleMode, label: t('bible.modeBilingual') },
          ]}
          selected={bibleMode}
          onSelect={(value) => void setBibleMode(value)}
        />
      </View>

      {bilingual && canGoSideBySide ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('bible.layoutLabel')}
          </Text>
          <SegmentedChoice
            testID="reader-layout"
            accessibilityLabel={t('bible.layoutLabel')}
            options={[
              { value: 'stacked' as BilingualLayout, label: t('bible.layoutStacked') },
              {
                value: 'sideBySide' as BilingualLayout,
                label: t('bible.layoutSideBySide'),
              },
            ]}
            selected={layout}
            onSelect={(value) => void setReadingPrefs({ layout: value })}
          />
        </View>
      ) : null}

      <Divider />
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.label, { color: colors.ink }]}>{t('settings.theme')}</Text>
        <SegmentedChoice
          testID="reader-theme"
          accessibilityLabel={t('settings.theme')}
          options={[
            { value: 'light' as ThemePreference, label: t('settings.themeLight') },
            { value: 'dark' as ThemePreference, label: t('settings.themeDark') },
            { value: 'system' as ThemePreference, label: t('settings.themeSystem') },
          ]}
          selected={themePreference}
          onSelect={(value) => void setThemePreference(value)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sample: { flex: 1, textAlign: 'center' },
  // The two glyphs the stepper needs. Drawn rather than typed, so "−"
  // and "+" do not depend on a font's punctuation metrics -- see
  // ../../../theme/ui/iconGeometry.ts for why this app draws its glyphs.
  bar: { width: 14, height: 2, borderRadius: 1 },
  barVertical: { position: 'absolute', width: 2, height: 14 },
  plus: { alignItems: 'center', justifyContent: 'center' },
});
