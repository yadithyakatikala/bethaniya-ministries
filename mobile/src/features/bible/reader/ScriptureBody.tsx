import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge } from '../../../theme/ui/Badge';
import { scriptureStyle, useTheme } from '../../../theme';
import { useTranslation } from '../../../i18n';
import { VerseRow } from './VerseRow';
import type { VerseAnnotation } from './useVerseAnnotations';
import type { BilingualPresentation, BilingualLayout } from '../alignment';
import type { BibleLanguage, BibleVerse } from '../types';
import type { TranslationId } from '../../../services/firebase/readerAnnotations';
import type { ReadingDensity, ReadingFont, ReadingSize } from '../../../theme/tokens';

/**
 * The words the row's state contributes to its accessibility label.
 *
 * Highlight state is a WORD, not just a colour: the four tints sit at
 * the same lightness so hue alone does not distinguish them (see
 * ../../../theme/tokens.ts), and a screen reader cannot see any of them.
 */
export function verseStateLabels(
  annotation: VerseAnnotation,
  t: (key: 'bible.highlighted' | 'bible.bookmarked' | 'bible.hasNote') => string
): string[] {
  const labels: string[] = [];
  if (annotation.highlight) labels.push(t('bible.highlighted'));
  if (annotation.bookmarked) labels.push(t('bible.bookmarked'));
  if (annotation.note) labels.push(t('bible.hasNote'));
  return labels;
}

/**
 * The narrowest screen on which two translations side by side are still
 * worth reading.
 *
 * Visual QA is what set this number. At 390dp -- an ordinary phone --
 * two columns leave about 145dp each, roughly eighteen characters a
 * line, and "In the beginning God created the heavens and the earth."
 * breaks across four lines per side. That is not a reading experience,
 * it is a column of fragments. 600dp is the conventional tablet
 * breakpoint and the first width at which each side gets a usable
 * measure.
 */
export const SIDE_BY_SIDE_MIN_WIDTH = 600;

/** Everything a verse row needs from the reader, in one object. */
export interface VerseHandlers {
  /** The reader's current typography, resolved from the saved settings. */
  size: ReadingSize;
  density: ReadingDensity;
  font: ReadingFont;
  bookId: string;
  chapter: number;
  /** The verse the action sheet is open for, if any. */
  selectedVerse: number | null;
  annotationFor: (
    translationId: TranslationId,
    bookId: string,
    chapter: number,
    verse: number
  ) => VerseAnnotation;
  onSelectVerse: (translationId: TranslationId, verse: number) => void;
  /** Reports a row's vertical offset, for scroll-to and position saving. */
  onVerseLayout: (verse: number, y: number) => void;
}

/** One translation's chapter. */
export function ScriptureBody({
  verses,
  language,
  handlers,
  idPrefix = '',
  reportLayout = true,
}: {
  verses: BibleVerse[];
  /** The script the verses are written in -- picks the scripture face. */
  language: BibleLanguage;
  handlers: VerseHandlers;
  /**
   * Namespaces the testIDs. A `chapterLevel` bilingual chapter renders
   * TWO of these lists over the same verse numbers, so without a prefix
   * both would claim `verse-1`.
   */
  idPrefix?: string;
  /**
   * False for the second list of a `chapterLevel` chapter: two lists
   * reporting the same verse numbers would fight over the reader's
   * scroll bookkeeping, and the first (English) list is the one whose
   * numbering the position is recorded against.
   */
  reportLayout?: boolean;
}) {
  const { colors, reading, type } = useTheme();
  const { t } = useTranslation();
  const translationId: TranslationId = language;

  return (
    <View
      testID={idPrefix ? `reader-verses-${idPrefix}` : 'reader-verses'}
      style={{ gap: reading.verseGap[handlers.density] }}
    >
      {verses.map((verse) => {
        const annotation = handlers.annotationFor(
          translationId,
          handlers.bookId,
          handlers.chapter,
          verse.number
        );
        /**
         * Seven verses of the WEB have no text at all -- Luke 17:36,
         * Acts 8:37, 15:34, 24:7 and Romans 16:25-27, whose only content
         * in the source is a translator's note that the manuscripts this
         * translation follows do not contain the verse.
         *
         * The NUMBER still prints: hiding it would make the chapter look
         * as though a verse were missing, which is the V1 mistake this
         * project has fixed twice already. What replaces the empty line
         * is the same sentence the app uses for the one chapter Telugu
         * lacks, so the absence reads as a fact about the translation
         * rather than as a rendering bug.
         */
        const absent = verse.text.trim().length === 0;
        return (
          <VerseRow
            key={verse.number}
            testID={`verse-${idPrefix}${verse.number}`}
            // "39-40" for a merged Telugu range, so no verse number
            // silently disappears the way it did in V1.
            label={
              verse.endNumber
                ? `${verse.number}-${verse.endNumber}`
                : String(verse.number)
            }
            annotation={annotation}
            selected={handlers.selectedVerse === verse.number}
            stateLabels={verseStateLabels(annotation, t)}
            textForAccessibility={absent ? t('bible.notInTranslation') : verse.text}
            onPress={() => handlers.onSelectVerse(translationId, verse.number)}
            onLayout={
              reportLayout
                ? (event) =>
                    handlers.onVerseLayout(verse.number, event.nativeEvent.layout.y)
                : undefined
            }
          >
            {absent ? (
              <Text
                testID={`verse-${idPrefix}${verse.number}-absent`}
                style={[type.bodySmall, styles.absent, { color: colors.inkMuted }]}
              >
                {t('bible.notInTranslation')}
              </Text>
            ) : (
              /* scriptureStyle(language), never the app language: the
                 verse must be set in the face that covers ITS script. */
              <Text
                style={[
                  scriptureStyle(
                    language,
                    handlers.size,
                    handlers.density,
                    handlers.font
                  ),
                  { color: colors.ink },
                ]}
              >
                {verse.text}
              </Text>
            )}
          </VerseRow>
        );
      })}
    </View>
  );
}

/**
 * Both translations, through the M1 alignment policy.
 *
 * This component has NO opinion about pairing -- it renders whichever of
 * the three presentations ../alignment.ts returned and nothing else.
 * That is the whole point of the policy: an English verse is never put
 * beside a Telugu verse unless the pairing can be proven.
 *
 *   paired         One row per Telugu unit, sharing one verse label,
 *                  stacked or side by side per the reader's setting.
 *   chapterLevel   The two traditions divide this chapter differently,
 *                  so each side is shown with its OWN numbering, its own
 *                  annotations, and a visible notice. Forcing rows here
 *                  would mis-pair scripture.
 *   englishOnly    Telugu has no text for this chapter (Malachi 4). Said
 *                  plainly -- never filled with invented verses.
 *
 * WHICH TRANSLATION A PAIRED ROW'S ANNOTATION BELONGS TO: the primary
 * Bible language, passed in as `primaryTranslation`. A paired row shows
 * two translations but an annotation belongs to one verse in one of
 * them, and the primary is the one the member chose as their Bible.
 */
export function BilingualBody({
  presentation,
  layout,
  primaryTranslation,
  handlers,
}: {
  presentation: BilingualPresentation;
  layout: BilingualLayout;
  primaryTranslation: TranslationId;
  handlers: VerseHandlers;
}) {
  const { colors, reading, spacing } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const gap = reading.verseGap[handlers.density];

  if (presentation.kind === 'paired') {
    // The member's choice, honoured only where it is legible -- a phone
    // falls back to stacked. The settings sheet does not offer the
    // option at all on a narrow screen, so this is the case where
    // someone chose it on a tablet and opened the same account here.
    const sideBySide = layout === 'sideBySide' && screenWidth >= SIDE_BY_SIDE_MIN_WIDTH;
    return (
      <View testID="bilingual-paired" style={{ gap }}>
        {presentation.rows.map((row) => {
          const annotation = handlers.annotationFor(
            primaryTranslation,
            handlers.bookId,
            handlers.chapter,
            row.start
          );
          return (
            <VerseRow
              key={row.start}
              testID={`verse-${row.start}`}
              label={row.label}
              annotation={annotation}
              selected={handlers.selectedVerse === row.start}
              stateLabels={verseStateLabels(annotation, t)}
              textForAccessibility={`${row.english} ${row.telugu}`}
              onPress={() => handlers.onSelectVerse(primaryTranslation, row.start)}
              onLayout={(event) =>
                handlers.onVerseLayout(row.start, event.nativeEvent.layout.y)
              }
            >
              <View style={sideBySide ? styles.columns : undefined}>
                {/* Each side gets the serif that covers its own script.
                    Noto Serif and Noto Serif Telugu are siblings, so the
                    pair reads as one typeface rather than two. */}
                <Text
                  style={[
                    scriptureStyle('en', handlers.size, handlers.density, handlers.font),
                    sideBySide ? styles.column : undefined,
                    { color: colors.ink },
                  ]}
                >
                  {row.english}
                </Text>
                <Text
                  style={[
                    scriptureStyle('te', handlers.size, handlers.density, handlers.font),
                    sideBySide ? styles.column : undefined,
                    { color: colors.ink },
                  ]}
                >
                  {row.telugu}
                </Text>
              </View>
            </VerseRow>
          );
        })}
      </View>
    );
  }

  if (presentation.kind === 'englishOnly') {
    return (
      <View testID="bilingual-english-only" style={{ gap }}>
        <Badge label={t('bible.notInTranslation')} variant="warning" />
        <ScriptureBody verses={presentation.english} language="en" handlers={handlers} />
      </View>
    );
  }

  return (
    <View testID="bilingual-chapter-level" style={{ gap }}>
      <Badge label={t('bible.numberingDiffers')} variant="warning" />
      <ScriptureBody
        verses={presentation.english}
        language="en"
        handlers={handlers}
        idPrefix="en-"
      />
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          marginVertical: spacing.sm,
          backgroundColor: colors.border,
        }}
      />
      <ScriptureBody
        verses={presentation.telugu.map((span) => ({
          number: span.start,
          endNumber: span.end > span.start ? span.end : undefined,
          text: span.text,
        }))}
        language="te"
        handlers={handlers}
        idPrefix="te-"
        reportLayout={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Italic, so an absent verse reads as an editorial note rather than as
  // scripture set small.
  absent: { fontStyle: 'italic' },
  columns: { flexDirection: 'row', gap: 14 },
  // Equal halves. A side-by-side pair where one column is wider reads as
  // a main text with a gloss, which is not what pairing two translations
  // of equal standing means.
  column: { flex: 1 },
});
