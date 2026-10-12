import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Icon,
  IconButton,
  SegmentedChoice,
  Sheet,
  Tappable,
  darkTokens,
  lightTokens,
  readingScale,
  sepiaTokens,
  serifFor,
  useTheme,
} from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { fontFamilies } from '../../../theme/tokens';
import { useTranslation } from '../../../i18n';
import { usePreferences } from '../../../context/PreferencesContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import type {
  ReadingDensity,
  ReadingFont,
  ReadingMeasure,
  ReadingSize,
} from '../../../theme/tokens';
import { SIDE_BY_SIDE_MIN_WIDTH } from './ScriptureBody';
import type { BilingualLayout } from '../alignment';
import type { BibleLanguage, BibleMode } from '../types';

/** Smallest to largest, so the -/+ buttons can step through them. */
const SIZE_STEPS = Object.keys(readingScale.size) as ReadingSize[];

type Page = 'light' | 'sepia' | 'dark';

/** The three pages, and the palette each previews in. */
const PAGES: { value: Page; palette: ThemeColors }[] = [
  { value: 'light', palette: lightTokens },
  { value: 'sepia', palette: sepiaTokens },
  { value: 'dark', palette: darkTokens },
];

/**
 * The reader's own settings -- a short sheet over a page that stays visible.
 *
 * THE SHEET IS SHORT BECAUSE THE PAGE IS THE SAMPLE. It dims what is behind it
 * far less than other sheets do (see `Sheet`'s `scrim`), and what it changes --
 * size, spacing, the page itself -- changes there, live, above it. What it holds
 * is what a reader reaches for mid-chapter:
 *
 *   Text size     a stepper around a small "Aa" and the size in points
 *   Line spacing  Compact | Normal | Relaxed
 *   Page          Light | Sepia | Dark, each drawn as a small page
 *   More settings opens the sheet out: the typeface, the Bible's language, the
 *                 width of the column -- and, on a tablet in bilingual mode, how
 *                 the two languages sit.
 *
 * SIZE IS A STEPPER, the rest are named choices. Six size steps as six chips
 * would be a row of unreadable numbers; two 44dp buttons is how every reading
 * app does it. Its buttons stop at the smallest and the largest.
 *
 * PAGE: LIGHT AND DARK ARE THE APP'S, SEPIA IS THE READER'S. Choosing Light or
 * Dark here is the same choice as choosing it in Settings -- one theme
 * preference in the app, not two that can disagree (see
 * ../../../services/firebase/userProfile.ts's ThemePreference) -- and it ends a
 * sepia page. Sepia changes the reader's page and chrome only, and is kept on
 * this phone alone (../../../context/readingPrefsStorage.ts's ReaderPage).
 * Choosing the page already in force changes nothing: a member who has the app
 * following their phone's theme is not moved off "System" by tapping the card
 * that already shows it.
 */
export function ReaderSettingsSheet({
  visible,
  onClose,
  bilingual,
  sampleLanguage,
}: {
  visible: boolean;
  onClose: () => void;
  bilingual: boolean;
  /** Which script the "Aa" sample is set in -- the Bible being read. */
  sampleLanguage: BibleLanguage;
}) {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  const {
    isDark: appIsDark,
    setThemePreference,
    bibleMode,
    setBibleMode,
  } = usePreferences();
  const { font, size, lineHeight, width, layout, page, setReadingPrefs, setReaderPage } =
    useReadingPreferences();
  const { width: screenWidth } = useWindowDimensions();
  const [opened, setOpened] = useState(false);
  // Side by side needs a tablet to be readable at all (see
  // ./ScriptureBody.tsx), so on a phone the row is not offered. A control for
  // something the device cannot show is noise -- the same reason the row is
  // absent outside bilingual mode.
  const canGoSideBySide = screenWidth >= SIDE_BY_SIDE_MIN_WIDTH;

  const sizeIndex = SIZE_STEPS.indexOf(size);
  const currentPage: Page = page === 'sepia' ? 'sepia' : appIsDark ? 'dark' : 'light';

  function stepSize(delta: number) {
    const next = SIZE_STEPS[sizeIndex + delta];
    if (next) void setReadingPrefs({ size: next });
  }

  function choosePage(next: Page) {
    if (next === currentPage) return;
    if (next === 'sepia') {
      void setReaderPage('sepia');
      return;
    }
    // Light and Dark are the app's own theme, and end a sepia page.
    void setReaderPage(null);
    void setThemePreference(next);
  }

  function close() {
    // Always opens short again.
    setOpened(false);
    onClose();
  }

  const label = (text: string) => (
    <Text style={[type.label, styles.label, { color: colors.ink }]}>{text}</Text>
  );

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('bible.readingSettings')}
      closeLabel={t('common.close')}
      testID="reader-settings-sheet"
      scrim="light"
      tall={opened}
    >
      <View style={styles.stepRow}>
        {label(t('bible.sizeLabel'))}
        <View style={styles.stepper}>
          <IconButton
            variant="tinted"
            accessibilityLabel={t('bible.decreaseSize')}
            testID="reader-size-decrease"
            disabled={sizeIndex <= 0}
            onPress={() => stepSize(-1)}
          >
            <Icon name="minus" size={20} />
          </IconButton>
          {/* "Aa", set in the face of the Bible being read, with the size
              beneath it. The page above is the real sample. */}
          <View
            style={styles.sample}
            accessible
            accessibilityLabel={`${readingScale.size[size]}`}
          >
            <Text
              testID="reader-size-sample"
              style={[
                styles.sampleAa,
                { color: colors.ink, fontFamily: serifFor(sampleLanguage) },
              ]}
            >
              Aa
            </Text>
            <Text
              testID="reader-size-value"
              style={[styles.sampleSize, { color: colors.inkMuted }]}
            >
              {readingScale.size[size]}
            </Text>
          </View>
          <IconButton
            variant="tinted"
            accessibilityLabel={t('bible.increaseSize')}
            testID="reader-size-increase"
            disabled={sizeIndex >= SIZE_STEPS.length - 1}
            onPress={() => stepSize(1)}
          >
            <Icon name="plus" size={20} />
          </IconButton>
        </View>
      </View>

      <View>
        {label(t('bible.lineHeightLabel'))}
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

      <View>
        {label(t('bible.page'))}
        <View style={styles.pages} accessibilityRole="radiogroup">
          {PAGES.map(({ value, palette }) => {
            const chosen = value === currentPage;
            const name =
              value === 'light'
                ? t('settings.themeLight')
                : value === 'sepia'
                  ? t('bible.pageSepia')
                  : t('settings.themeDark');
            return (
              <Tappable
                key={value}
                testID={`reader-page-${value}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                accessibilityLabel={name}
                onPress={() => choosePage(value)}
                style={[
                  styles.page,
                  chosen ? styles.pageChosen : styles.pageIdle,
                  { borderColor: chosen ? colors.ink : colors.border },
                ]}
              >
                {/* A small page: its paper, and three lines of its ink. */}
                <View
                  style={[
                    styles.preview,
                    { backgroundColor: palette.paper, borderColor: 'rgba(0,0,0,0.08)' },
                    value === 'dark' && { borderColor: darkTokens.border },
                  ]}
                >
                  <View style={[styles.line, { backgroundColor: palette.ink }]} />
                  <View
                    style={[styles.line, styles.line2, { backgroundColor: palette.ink }]}
                  />
                  <View
                    style={[styles.line, styles.line3, { backgroundColor: palette.ink }]}
                  />
                </View>
                <View style={styles.pageName}>
                  {chosen ? <Icon name="check" size={14} /> : null}
                  <Text style={[styles.pageLabel, { color: colors.ink }]}>{name}</Text>
                </View>
              </Tappable>
            );
          })}
        </View>
      </View>

      {opened ? (
        <>
          <View>
            {label(t('bible.fontLabel'))}
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

          {/* WHICH BIBLE. The same `bibleMode` preference Settings owns, not a
              reader-local copy -- the Bible preference is independent of the
              interface language, and it must stay ONE value. It is also
              chosen from the language pill in the top bar; this is a third way
              to the same setting, not a third setting. */}
          <View>
            {label(t('settings.bibleLanguage'))}
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

          <View>
            {label(t('bible.widthLabel'))}
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

          {bilingual && canGoSideBySide ? (
            <View>
              {label(t('bible.layoutLabel'))}
              <SegmentedChoice
                testID="reader-layout"
                accessibilityLabel={t('bible.layoutLabel')}
                options={[
                  {
                    value: 'stacked' as BilingualLayout,
                    label: t('bible.layoutStacked'),
                  },
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
        </>
      ) : (
        <Tappable
          testID="reader-more-settings"
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          accessibilityLabel={t('bible.moreSettings')}
          onPress={() => setOpened(true)}
          style={[
            styles.more,
            {
              borderTopColor: colors.border,
              marginHorizontal: -spacing.screen,
              paddingHorizontal: spacing.screen,
            },
          ]}
        >
          <Text style={[styles.moreText, { color: colors.ink }]}>
            {t('bible.moreSettings')}
          </Text>
          <Icon name="chevd" size={20} color={colors.inkSubtle} />
        </Tappable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sample: { minWidth: 64, alignItems: 'center' },
  sampleAa: { fontSize: 19, lineHeight: 26, textAlign: 'center' },
  sampleSize: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  pages: { flexDirection: 'row', gap: 10 },
  page: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
  },
  // The chosen page's 2pt ring takes a point from the padding, so no card moves.
  pageIdle: { borderWidth: 1, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 8 },
  pageChosen: { borderWidth: 2, paddingTop: 9, paddingHorizontal: 9, paddingBottom: 7 },
  preview: {
    width: '100%',
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 5,
  },
  line: { height: 3, borderRadius: 2, opacity: 0.75 },
  line2: { width: '78%' },
  line3: { width: '58%' },
  pageName: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pageLabel: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 12.5,
    lineHeight: 16,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderTopWidth: 1,
  },
  moreText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
  },
});
