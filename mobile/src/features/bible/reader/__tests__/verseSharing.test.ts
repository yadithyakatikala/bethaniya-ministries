import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import {
  buildBilingualCopyText,
  buildBilingualShareText,
  buildCopyText,
  buildShareText,
  copyText,
  shareText,
} from '../verseSharing';
import {
  TRANSLATION_ATTRIBUTION,
  TRANSLATION_NAMES,
} from '../../translationCredits';

/**
 * What a shared or copied verse actually looks like.
 *
 * These are the strings that leave the app and land in someone else's
 * chat window, so they are asserted as whole text rather than by
 * substring where the shape matters -- a reference that reads
 * "undefined 3:16" is exactly the kind of defect a substring check
 * would sail past.
 */
const JOHN_3_16 = 'For God so loved the world, that he gave his only born Son…';
const JOHN_3_16_TE = 'దేవుడు లోకాన్ని ఎంతో ప్రేమించాడు…';

describe('sharing one translation', () => {
  it('quotes the verse, then names the reference -- and nothing else', () => {
    expect(
      buildShareText({
        bookName: 'John',
        chapter: 3,
        label: '16',
        text: JOHN_3_16,
      })
    ).toBe(`"${JOHN_3_16}"\n\nJohn 3:16`);
  });

  it('carries NO licence block, in either language', () => {
    // M6. The copyright line made every shared verse read like a licence
    // notice with some scripture attached. The obligation is on bundling
    // the text, and it is met by the Settings screen's credits card --
    // see ../../translationCredits.ts.
    for (const [bookName, text] of [
      ['John', JOHN_3_16],
      ['యోహాను', JOHN_3_16_TE],
    ] as const) {
      const shared = buildShareText({ bookName, chapter: 3, label: '16', text });
      expect(shared).not.toContain(TRANSLATION_NAMES.te);
      expect(shared).not.toContain(TRANSLATION_NAMES.en);
      expect(shared).not.toContain(TRANSLATION_ATTRIBUTION.te as string);
      expect(shared).not.toContain('CC BY-SA');
      expect(shared).not.toContain('©');
    }
  });

  it('is exactly three lines: the quote, a blank, the reference', () => {
    expect(
      buildShareText({
        bookName: 'యోహాను',
        chapter: 3,
        label: '16',
        text: JOHN_3_16_TE,
      }).split('\n')
    ).toEqual([`"${JOHN_3_16_TE}"`, '', 'యోహాను 3:16']);
  });

  it('keeps a merged range label intact, so the reference matches the page', () => {
    expect(
      buildShareText({
        bookName: 'Luke',
        chapter: 1,
        label: '39-40',
        text: 'Mary arose in those days…',
      })
    ).toContain('Luke 1:39-40');
  });
});

describe('sharing a paired bilingual verse', () => {
  const shared = buildBilingualShareText({
    bookName: 'Genesis',
    chapter: 1,
    label: '1',
    english: 'In the beginning God created the heavens and the earth.',
    telugu: 'ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.',
  });

  it('leads with the reference, then each language as its own quoted block', () => {
    expect(shared).toBe(
      [
        'Genesis 1:1',
        '',
        '"In the beginning God created the heavens and the earth."',
        '',
        '"ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు."',
      ].join('\n')
    );
  });

  it('carries no licence block either', () => {
    expect(shared).not.toContain('CC BY-SA');
    expect(shared).not.toContain('©');
    expect(shared).not.toContain(TRANSLATION_NAMES.te);
  });

  it('reads as text, not as a dumped data structure', () => {
    // The brief's rule: a shared bilingual verse must be useful and
    // readable rather than an internal object.
    for (const artefact of ['{', '}', '[object', 'undefined', 'kind:']) {
      expect(shared).not.toContain(artefact);
    }
  });
});

describe('copying a verse', () => {
  it('puts the reference on its own line above the text', () => {
    expect(
      buildCopyText({ bookName: 'John', chapter: 3, label: '16', text: JOHN_3_16 })
    ).toBe(`John 3:16\n${JOHN_3_16}`);
  });

  it('trims stray whitespace from the corpus rather than pasting it', () => {
    expect(
      buildCopyText({
        bookName: 'John',
        chapter: 3,
        label: '16',
        text: `  ${JOHN_3_16}  `,
      })
    ).toBe(`John 3:16\n${JOHN_3_16}`);
  });

  it('copies both translations of a paired verse, in reading order', () => {
    expect(
      buildBilingualCopyText({
        bookName: 'Genesis',
        chapter: 1,
        label: '1',
        english: 'In the beginning…',
        telugu: 'ఆరంభంలో…',
      })
    ).toBe('Genesis 1:1\nIn the beginning…\nఆరంభంలో…');
  });
});

describe('handing text to the platform', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
  });

  it('reports success when the clipboard accepts the text', async () => {
    await expect(copyText('John 3:16')).resolves.toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('John 3:16');
  });

  it('reports failure instead of throwing when the clipboard is unavailable', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
      new Error('no clipboard')
    );
    await expect(copyText('John 3:16')).resolves.toBe(false);
  });

  it('reports failure instead of throwing when the share sheet rejects', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockRejectedValueOnce(new Error('dismissed'));
    await expect(shareText('John 3:16')).resolves.toBe(false);
    share.mockRestore();
  });
});
