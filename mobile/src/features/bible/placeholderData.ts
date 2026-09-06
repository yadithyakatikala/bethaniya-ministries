/**
 * SYNTHETIC PLACEHOLDER DATA -- NOT A REAL BIBLE TRANSLATION.
 *
 * These are NOT verbatim scripture quotations from any copyrighted or
 * licensed translation. Wording is deliberately paraphrased/synthetic so
 * this file cannot be mistaken for, or accidentally shipped as, licensed
 * Bible text. Do not replace this with real Bible text until
 * /BIBLE_LICENSING.md's status changes from "BLOCKED FOR PRODUCTION" to a
 * confirmed license for the language in question.
 *
 * Per FINAL_ARCHITECTURE_SPECIFICATION.md Section C, Option 3: placeholder
 * content is an explicitly sanctioned way to build and test the Bible
 * screen's UI/navigation now, without blocking on Bible licensing.
 */
import type { BibleVerse } from './types';

export const PLACEHOLDER_VERSES: BibleVerse[] = [
  {
    id: 'placeholder-en-1',
    language: 'en',
    reference: '[Placeholder] Sample Reference 1:1',
    text: '[Placeholder verse text -- English. Real translation pending, see BIBLE_LICENSING.md.]',
    isPlaceholder: true,
  },
  {
    id: 'placeholder-en-2',
    language: 'en',
    reference: '[Placeholder] Sample Reference 2:3',
    text: '[Placeholder verse text -- English. Real translation pending, see BIBLE_LICENSING.md.]',
    isPlaceholder: true,
  },
  {
    id: 'placeholder-te-1',
    language: 'te',
    reference: '[ప్లేస్‌హోల్డర్] నమూనా రిఫరెన్స్ 1:1',
    text: '[ప్లేస్‌హోల్డర్ వచనం -- తెలుగు. నిజమైన అనువాదం పెండింగ్‌లో ఉంది, BIBLE_LICENSING.md చూడండి.]',
    isPlaceholder: true,
  },
];
