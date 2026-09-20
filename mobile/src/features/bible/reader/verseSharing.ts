/**
 * Turning a verse into text someone can send or paste.
 *
 * =====================================================================
 * WHAT A SHARED VERSE CONTAINS -- AND WHAT IT NO LONGER DOES
 * =====================================================================
 * The verse, and its reference. Nothing else.
 *
 * Until M6 a shared verse also carried the translation's published title
 * and, for the Telugu IRV, its CC BY-SA copyright line. The reasoning
 * was that sharing into a chat is redistribution; the result in practice
 * was that every verse a member sent their family read like a licence
 * notice with some scripture attached:
 *
 *     "యెహోవా నా కాపరి. నాకు ఏ లోటూ లేదు."
 *
 *     కీర్తనల గ్రంథము 23:1 (Indian Revised Version (IRV) 2019)
 *     © Bridge Connectivity Solutions, CC BY-SA 4.0
 *
 * THE ATTRIBUTION HAS NOT BEEN REMOVED FROM THE APP. It lives in
 * ../translationCredits.ts and is shown, in full and permanently, on the
 * Settings screen's "Bible translations" card -- which is where the
 * licence obligation on bundling the text actually sits. Quoting a verse
 * into a message is a person citing scripture, and it now reads like
 * one. See /BIBLE_LICENSING.md.
 *
 * =====================================================================
 * BILINGUAL
 * =====================================================================
 * A paired verse is the reference, then each language as its own quoted
 * block -- NOT a dumped object, and not two texts run together where the
 * recipient cannot tell which is which.
 */
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * What goes into a share sheet for one verse: the words, then the
 * reference. The `translationId` the reader passes is deliberately NOT
 * used to name the translation -- see this file's header.
 */
export function buildShareText(options: {
  bookName: string;
  chapter: number;
  label: string;
  text: string;
}): string {
  const { bookName, chapter, label, text } = options;
  return `"${text.trim()}"\n\n${bookName} ${chapter}:${label}`;
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
  return [
    `${bookName} ${chapter}:${label}`,
    '',
    `"${english.trim()}"`,
    '',
    `"${telugu.trim()}"`,
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
