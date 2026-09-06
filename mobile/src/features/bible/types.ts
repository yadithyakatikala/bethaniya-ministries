/**
 * Bible module types.
 *
 * See /BIBLE_LICENSING.md at the repo root for why this module currently
 * renders synthetic placeholder text instead of a real translation, and
 * what has to happen before that changes.
 */

export type BibleLanguage = 'en' | 'te';

export interface BibleVerse {
  /** Stable id, e.g. "john-3-16". Not a real versification scheme yet. */
  id: string;
  language: BibleLanguage;
  /** Human-readable reference, e.g. "John 3:16". */
  reference: string;
  text: string;
  /**
   * Always true today. Exists so the UI, and any future data-loading code,
   * can render/handle placeholder content differently from a real
   * translation without needing a separate type -- swapping the data
   * source later doesn't require a type change, only setting this false
   * (or removing it) once real, licensed verses are wired in.
   */
  isPlaceholder: true;
}
