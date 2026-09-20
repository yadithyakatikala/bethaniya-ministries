import { addDoc, setDoc } from 'firebase/firestore';
import { reportedItemKey, submitReport } from '../reports';

jest.mock('../app', () => ({ db: {} }));

/**
 * Filing a report.
 *
 * The marker id is the load-bearing detail: it is deterministic, so
 * reporting the same thing twice is unrepresentable rather than merely
 * discouraged -- the same decision ./media.ts's likes and saves already
 * made.
 */
describe('the marker id', () => {
  it('is the same for the same target every time', () => {
    expect(reportedItemKey('community_message', 'c1')).toBe(
      reportedItemKey('community_message', 'c1')
    );
  });

  it('distinguishes two kinds of thing that share an id', () => {
    // A media post and a chat message could, in principle, both be 'x1'.
    expect(reportedItemKey('media', 'x1')).not.toBe(
      reportedItemKey('community_message', 'x1')
    );
  });
});

describe('what a report carries', () => {
  beforeEach(() => {
    (addDoc as jest.Mock).mockClear();
    (setDoc as jest.Mock).mockClear();
  });

  it('names the content and the reporter, and starts open', () => {
    void submitReport({
      reporterUid: 'member-1',
      targetType: 'community_message',
      targetId: 'c1',
      reason: 'harassment',
      details: '  This was unkind.  ',
    });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.targetType).toBe('community_message');
    expect(payload.targetId).toBe('c1');
    expect(payload.reporterUid).toBe('member-1');
    expect(payload.reason).toBe('harassment');
    expect(payload.details).toBe('This was unkind.');
    expect(payload.status).toBe('open');
  });

  it('carries no resolution fields -- those are the administrator’s', () => {
    void submitReport({
      reporterUid: 'member-1',
      targetType: 'media',
      targetId: 'm1',
      reason: 'spam',
    });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('resolvedByUid');
    expect(payload).not.toHaveProperty('resolvedAt');
    expect(payload).not.toHaveProperty('resolutionNote');
  });

  it('names NOTHING about the author of the reported content', () => {
    // This is what makes reporting an anonymous prayer request safe: the
    // device has no author to name, so reporting somebody cannot
    // de-anonymise them.
    void submitReport({
      reporterUid: 'member-1',
      targetType: 'prayer_request',
      targetId: 'p1',
      reason: 'other',
    });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain('authorUid');
    expect(Object.keys(payload)).not.toContain('authorName');
  });

  it('stores empty details as null rather than an empty string', () => {
    void submitReport({
      reporterUid: 'member-1',
      targetType: 'media',
      targetId: 'm1',
      reason: 'spam',
      details: '   ',
    });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.details).toBeNull();
  });

  it('carries the parent post when a COMMENT is reported', () => {
    // A comment lives in a subcollection, so the post is required to
    // address it at all.
    void submitReport({
      reporterUid: 'member-1',
      targetType: 'media_comment',
      targetId: 'cm1',
      targetParentId: 'm1',
      reason: 'spam',
    });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.targetParentId).toBe('m1');
  });

  it('also writes the member’s own marker', async () => {
    await submitReport({
      reporterUid: 'member-1',
      targetType: 'media',
      targetId: 'm1',
      reason: 'spam',
    });
    expect(setDoc as jest.Mock).toHaveBeenCalled();
  });
});
