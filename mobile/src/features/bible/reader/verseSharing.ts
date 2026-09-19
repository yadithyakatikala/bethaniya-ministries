/**
 * Turning a verse into text someone can send or paste.
 *
 * =====================================================================
 * WHY THE TRANSLATION IS NAMED, NOT JUST THE REFERENCE
 * =====================================================================
 * The Telugu text is the Indian Revised Version, licensed CC BY-SA 4.0
 * -- a licence that conditions REDISTRIBUTION on attribution, and
 * sharing a verse into a chat is redistribution. So a shared Telugu
 * verse carries the translation and its copyright line; the English WEB
 * is public domain and needs none, but is still named so the recipient
 * knows which Bible they are reading. See /BIBLE_LICENSING.md.
 *
 * =====================================================================
 * BILINGUAL
 * =====================================================================
 * A paired verse is formatted as a reference, then each translation as
 * its own quoted block with its own name underneath. NOT as a dumped
 * object, and not as two texts run together where the recipient cannot
 * tell which is which.
 *
 * The single-translation formatter is ../alignment.ts's
 * formatVerseForSharing(), reused rather than rewritten -- that function
 * is the M1 code that already decides what a shared reference looks
 * like.
 */
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { formatVerseForSharing } from '../alignment';
import type { TranslationId } from '../../../services/firebase/readerAnnotations';

/**
 * Translation names. NOT localized and NOT in the i18n catalogue: these
 * are the published titles of two specific translations, which is a
 * proper noun, not interface copy. See ../../../i18n/strings.ts's header
 * ("WHAT IS NOT HERE").
 */
export const TRANSLATION_NAMES: Record<TranslationId, string> = {
  en: 'World English Bible',
  te: 'Indian Revised Version (IRV) 2019',
};

/**
 * The attribution a share must carry. `null` for the WEB, which is
 * public domain; the IRV's line is the same one the Settings screen's
 * attribution card shows.
 */
export const TRANSLATION_ATTRIBUTION: Record<TranslationId, string | null> = {
  en: null,
  te: '© Bridge Connectivity Solutions, CC BY-SA 4.0',
};

function attributionSuffix(translationId: TranslationId): string {
  const attribution = TRANSLATION_ATTRIBUTION[translationId];
  return attribution ? `\n${attribution}` : '';
}

/** What goes into a share sheet for one translation's verse. */
export function buildShareText(options: {
  bookName: string;
  chapter: number;
  label: string;
  text: string;
  translationId: TranslationId;
}): string {
  const { bookName, chapter, label, text, translationId } = options;
  return (
    formatVerseForSharing({
      bookName,
      chapter,
      label,
      text,
      translationName: TRANSLATION_NAMES[translationId],
    }) + attributionSuffix(translationId)
  );
}

/** What goes into a share sheet for a paired bilingual verse. */
export function buildBilingualShareText(options: {
  bookName: string;
  chapter: number;
  label: string;
  english: string;
  telugu: string;
}): string {
  const { bookName, chapter, label, english, telugu } = options;
  const attribution = TRANSLATION_ATTRIBUTION.te;
  return [
    `${bookName} ${chapter}:${label}`,
    '',
    `"${english.trim()}"`,
    `— ${TRANSLATION_NAMES.en}`,
    '',
    `"${telugu.trim()}"`,
    `— ${TRANSLATION_NAMES.te}${attribution ? `, ${attribution}` : ''}`,
  ].join('\n');
}

/**
 * What goes on the clipboard: the reference on its own line, then the
 * text -- "John 3:16\nFor God so loved the world...".
 *
 * Deliberately plainer than the share text. A pasted verse usually lands
 * in a document or a sermon note that supplies its own framing, so it
 * gets no quotation marks and no attribution block; the reference is
 * what makes it checkable.
 */
export function buildCopyText(options: {
  bookName: string;
  chapter: number;
  label: string;
  text: string;
}): string {
  const { bookName, chapter, label, text } = options;
  return `${bookName} ${chapter}:${label}\n${text.trim()}`;
}

/** Both translations, for copying a paired verse. */
export function buildBilingualCopyText(options: {
  bookName: string;
  chapter: number;
  label: string;
  english: string;
  telugu: string;
}): string {
  const { bookName, chapter, label, english, telugu } = options;
  return `${bookName} ${chapter}:${label}\n${english.trim()}\n${telugu.trim()}`;
}

/**
 * Hands `text` to the platform share sheet.
 *
 * Returns false rather than throwing: a share the user dismisses and a
 * share that failed are both "nothing happened", and the reader should
 * not raise an error banner for either. The distinction the caller does
 * need -- did anything go wrong -- is what the boolean carries.
 */
export async function shareText(text: string): Promise<boolean> {
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
