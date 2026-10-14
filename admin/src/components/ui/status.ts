/**
 * Where a piece of content stands, as members are concerned.
 *
 *   draft      not visible to members; still being worked on
 *   scheduled  finished and waiting for its moment
 *   published  visible to members now
 *   archived   retired: hidden, but kept
 *   live       happening right now (an event's live stream)
 */
export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived' | 'live';

export const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
  live: 'Live',
};
