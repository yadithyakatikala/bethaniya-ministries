import { mergeUpdates } from '../updates';
import type { PublishedAnnouncement } from '../../../services/firebase/announcements';
import type { PublishedCommunityPost } from '../../../services/firebase/communityPosts';

function announcement(
  id: string,
  date: string | null,
  title = `A ${id}`
): PublishedAnnouncement {
  return {
    id,
    title,
    content: `${title} body`,
    imageUrl: null,
    createdAt: date ? new Date(date) : null,
  };
}

function post(
  id: string,
  date: string | null,
  title = `P ${id}`
): PublishedCommunityPost {
  return {
    id,
    title,
    content: `${title} body`,
    imageUrl: `https://example.org/${id}.jpg`,
    createdAt: date ? new Date(date) : null,
  };
}

describe('mergeUpdates', () => {
  it('is empty when the church has published neither', () => {
    expect(mergeUpdates([], [])).toEqual([]);
  });

  it('puts announcements and church posts in ONE list, newest first', () => {
    const merged = mergeUpdates(
      [
        announcement('a1', '2026-03-01T09:00:00Z'),
        announcement('a2', '2026-03-05T09:00:00Z'),
      ],
      [post('p1', '2026-03-03T09:00:00Z'), post('p2', '2026-03-07T09:00:00Z')]
    );
    expect(merged.map((item) => item.key)).toEqual([
      'post-p2',
      'announcement-a2',
      'post-p1',
      'announcement-a1',
    ]);
  });

  it('labels each item with what it is', () => {
    const merged = mergeUpdates(
      [announcement('a1', '2026-03-01T00:00:00Z')],
      [post('p1', '2026-03-02T00:00:00Z')]
    );
    expect(merged.map((item) => item.kind)).toEqual(['post', 'announcement']);
  });

  it('keeps an announcement and a post that share an id apart: two collections hand out the same ids', () => {
    const merged = mergeUpdates(
      [announcement('x', '2026-03-01T00:00:00Z')],
      [post('x', '2026-03-02T00:00:00Z')]
    );
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((item) => item.key)).size).toBe(2);
    expect(merged.map((item) => item.id)).toEqual(['x', 'x']);
  });

  it('puts an item with no date LAST: "no date" is not "newest"', () => {
    const merged = mergeUpdates(
      [announcement('undated', null), announcement('old', '2020-01-01T00:00:00Z')],
      [post('new', '2026-03-02T00:00:00Z')]
    );
    expect(merged.map((item) => item.id)).toEqual(['new', 'old', 'undated']);
  });

  it('keeps the original record, for the detail screen’s route params', () => {
    const a = announcement('a1', '2026-03-01T00:00:00Z');
    const p = post('p1', '2026-03-02T00:00:00Z');
    const [first, second] = mergeUpdates([a], [p]);
    expect(first.post).toBe(p);
    expect(first.announcement).toBeUndefined();
    expect(second.announcement).toBe(a);
    expect(second.post).toBeUndefined();
  });

  it('carries the title, the words and the picture through unchanged', () => {
    const [item] = mergeUpdates([], [post('p1', '2026-03-02T00:00:00Z', 'A testimony')]);
    expect(item).toMatchObject({
      title: 'A testimony',
      content: 'A testimony body',
      imageUrl: 'https://example.org/p1.jpg',
    });
  });

  it('keeps announcements first when two items have the same date (the sort is stable)', () => {
    const same = '2026-03-01T09:00:00Z';
    const merged = mergeUpdates([announcement('a', same)], [post('p', same)]);
    expect(merged.map((item) => item.key)).toEqual(['announcement-a', 'post-p']);
  });

  it('does not change the lists it was given', () => {
    const announcements = [
      announcement('a1', '2026-03-01T00:00:00Z'),
      announcement('a2', '2026-03-05T00:00:00Z'),
    ];
    const posts = [post('p1', '2026-03-03T00:00:00Z')];
    const before = JSON.stringify([announcements, posts]);
    mergeUpdates(announcements, posts);
    expect(JSON.stringify([announcements, posts])).toBe(before);
  });
});
