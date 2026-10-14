import { describe, expect, it } from 'vitest';
import {
  formatScheduleTime,
  isGoingLive,
  isVisibleToMembers,
  planStatusOf,
  statusFieldsFor,
  statusLabelFor,
  storedStatusOf,
  unchangedStatusFields,
} from '../planStatus';
import { makePlan } from './fixtures';

const NOW = new Date('2026-06-15T12:00:00Z');
const EARLIER = new Date('2026-06-15T11:00:00Z');
const LATER = new Date('2026-06-15T13:00:00Z');

describe('what status a plan is in', () => {
  it.each([
    ['draft', { status: 'draft', published: false, publishAt: null }, 'draft'],
    ['published', { status: 'published', published: true, publishAt: null }, 'published'],
    ['archived', { status: 'archived', published: false, publishAt: null }, 'archived'],
    [
      'scheduled in the future',
      { status: 'scheduled', published: false, publishAt: LATER },
      'scheduled',
    ],
  ] as const)('reads %s', (_name, fields, expected) => {
    expect(planStatusOf(makePlan(fields), NOW)).toBe(expected);
  });

  it('treats a scheduled plan whose time has come as published, because members can read it', () => {
    const due = makePlan({ status: 'scheduled', published: false, publishAt: EARLIER });
    expect(planStatusOf(due, NOW)).toBe('published');
    expect(isVisibleToMembers(due, NOW)).toBe(true);
    // ...exactly at the moment, too.
    expect(planStatusOf(makePlan({ status: 'scheduled', publishAt: NOW }), NOW)).toBe(
      'published'
    );
  });

  it('keeps a scheduled plan hidden until its time, and a draft or archived plan always', () => {
    expect(
      isVisibleToMembers(makePlan({ status: 'scheduled', publishAt: LATER }), NOW)
    ).toBe(false);
    expect(isVisibleToMembers(makePlan({ status: 'draft' }), NOW)).toBe(false);
    expect(isVisibleToMembers(makePlan({ status: 'archived' }), NOW)).toBe(false);
    expect(
      isVisibleToMembers(makePlan({ status: 'published', published: true }), NOW)
    ).toBe(true);
  });

  it('reads a scheduled plan with no time as still scheduled, never as live', () => {
    expect(planStatusOf(makePlan({ status: 'scheduled', publishAt: null }), NOW)).toBe(
      'scheduled'
    );
  });

  it('reads a plan written before the manager from its published flag alone', () => {
    expect(planStatusOf(makePlan({ status: null, published: true }), NOW)).toBe(
      'published'
    );
    expect(planStatusOf(makePlan({ status: null, published: false }), NOW)).toBe('draft');
    expect(storedStatusOf(makePlan({ status: null, published: true }))).toBe('published');
    expect(storedStatusOf(makePlan({ status: null, published: false }))).toBe('draft');
  });

  it('does not promote a due schedule when asked what is STORED', () => {
    const due = makePlan({ status: 'scheduled', publishAt: EARLIER });
    expect(storedStatusOf(due)).toBe('scheduled');
  });
});

describe('what a status change writes', () => {
  it('keeps published in step with status, always', () => {
    expect(statusFieldsFor({ to: 'published' })).toEqual({
      status: 'published',
      published: true,
      publishAt: null,
    });
    expect(statusFieldsFor({ to: 'draft' })).toEqual({
      status: 'draft',
      published: false,
      publishAt: null,
    });
    expect(statusFieldsFor({ to: 'archived' })).toEqual({
      status: 'archived',
      published: false,
      publishAt: null,
    });
    expect(statusFieldsFor({ to: 'scheduled', publishAt: LATER })).toEqual({
      status: 'scheduled',
      published: false,
      publishAt: LATER,
    });
  });

  it('never writes a published plan that is not status published', () => {
    for (const change of [
      { to: 'published' },
      { to: 'draft' },
      { to: 'archived' },
      { to: 'scheduled', publishAt: LATER },
    ] as const) {
      const fields = statusFieldsFor(change);
      expect(fields.published).toBe(fields.status === 'published');
    }
  });

  it('writes back what is stored when a save leaves the status alone', () => {
    expect(unchangedStatusFields(makePlan({ status: null, published: true }))).toEqual({
      status: 'published',
      published: true,
      publishAt: null,
    });
    expect(unchangedStatusFields(makePlan({ status: 'archived' }))).toEqual({
      status: 'archived',
      published: false,
      publishAt: null,
    });
    expect(
      unchangedStatusFields(
        makePlan({ status: 'scheduled', published: false, publishAt: LATER })
      )
    ).toEqual({ status: 'scheduled', published: false, publishAt: LATER });
  });

  it('knows which changes put a plan in front of members', () => {
    expect(isGoingLive({ to: 'published' })).toBe(true);
    expect(isGoingLive({ to: 'scheduled', publishAt: LATER })).toBe(true);
    expect(isGoingLive({ to: 'draft' })).toBe(false);
    expect(isGoingLive({ to: 'archived' })).toBe(false);
    expect(isGoingLive(null)).toBe(false);
  });
});

describe('words for a status', () => {
  it('names the time of a scheduled plan', () => {
    const label = statusLabelFor(
      makePlan({ status: 'scheduled', publishAt: LATER }),
      NOW
    );
    expect(label).toBe(`Scheduled · ${formatScheduleTime(LATER)}`);
  });

  it('adds nothing for any other status', () => {
    expect(statusLabelFor(makePlan({ status: 'draft' }), NOW)).toBeUndefined();
    expect(
      statusLabelFor(makePlan({ status: 'scheduled', publishAt: EARLIER }), NOW)
    ).toBeUndefined();
  });
});
