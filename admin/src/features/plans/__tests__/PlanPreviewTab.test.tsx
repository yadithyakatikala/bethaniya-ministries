import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { PlanPreviewTab } from '../PlanPreviewTab';
import { emptyDetails, type PlanDetailsForm } from '../planDetails';
import { blankDay, type DayDraft } from '../planDays';

const DETAILS: PlanDetailsForm = {
  ...emptyDetails(),
  title: 'Seven Days in the Psalms',
  subtitle: 'Rest for the weary',
  description: 'A week of psalms.',
  category: 'Devotional',
  coverImageUrl: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
  language: 'te',
  estimatedMinutes: '10',
  author: 'Pastor Samuel',
};

function day(key: string, overrides: Partial<DayDraft> = {}): DayDraft {
  return { ...blankDay(key), title: key, passages: ['Psalm 23'], ...overrides };
}

function setup(props: Partial<React.ComponentProps<typeof PlanPreviewTab>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <PlanPreviewTab
        details={DETAILS}
        days={[day('Day one')]}
        visibleToMembers={false}
        {...props}
      />
    </ThemeProvider>
  );
}

describe('PlanPreviewTab', () => {
  it('says members cannot see the plan yet, when they cannot', () => {
    setup({ visibleToMembers: false });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Members cannot see this plan yet. This is how it will look when it is published.'
    );
  });

  it('says this is what members see, including unsaved edits, when they can', () => {
    setup({ visibleToMembers: true });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This is how members see the plan now, including any changes you have not saved yet.'
    );
  });

  describe('the card in the plan library', () => {
    it('shows everything a member sees before opening the plan', () => {
      setup({
        days: [day('a'), day('b'), day('c')],
      });
      const card = screen.getByTestId('plan-preview-card');
      expect(within(card).getByTestId('plan-preview-title')).toHaveTextContent(
        'Seven Days in the Psalms'
      );
      expect(card).toHaveTextContent('Rest for the weary');
      expect(card).toHaveTextContent('A week of psalms.');
      expect(card).toHaveTextContent('Devotional');
      expect(card).toHaveTextContent(
        '3 days · about 10 min a day · Telugu · by Pastor Samuel'
      );
      expect(screen.getByTestId('plan-preview-cover')).toHaveAttribute(
        'src',
        DETAILS.coverImageUrl!
      );
    });

    it('says "1 day" and leaves out what was not given', () => {
      setup({
        details: { ...DETAILS, estimatedMinutes: '', author: '', subtitle: '' },
        days: [day('a')],
      });
      expect(screen.getByTestId('plan-preview-card')).toHaveTextContent('1 day · Telugu');
      expect(screen.getByTestId('plan-preview-card')).not.toHaveTextContent('about');
      expect(screen.getByTestId('plan-preview-card')).not.toHaveTextContent('by ');
    });

    it('shows a placeholder where there is no cover, rather than a broken picture', () => {
      setup({ details: { ...DETAILS, coverImageUrl: null } });
      expect(screen.getByTestId('plan-preview-no-cover')).toHaveTextContent(
        'No cover image'
      );
      expect(screen.queryByTestId('plan-preview-cover')).not.toBeInTheDocument();
    });

    it('shows placeholders for what has not been written yet', () => {
      setup({
        details: { ...emptyDetails(), category: '' },
        days: [],
      });
      expect(screen.getByTestId('plan-preview-title')).toHaveTextContent('Untitled plan');
      expect(screen.getByTestId('plan-preview-card')).toHaveTextContent(
        'The description will appear here.'
      );
      expect(screen.getByTestId('plan-preview-card')).toHaveTextContent('0 days');
    });
  });

  describe('a day', () => {
    it('shows the reading, the title and the Read button text', () => {
      setup();
      const preview = screen.getByTestId('plan-preview-day');
      expect(within(preview).getByTestId('plan-preview-reference')).toHaveTextContent(
        'Psalm 23'
      );
      expect(within(preview).getByTestId('plan-preview-day-title')).toHaveTextContent(
        'Day one'
      );
      expect(preview).toHaveTextContent('Day 1 of 1');
      expect(preview).toHaveTextContent('Opens in the Bible');
    });

    it('shows each part the day has, and only those', () => {
      setup({
        days: [
          day('Full', {
            devotional: 'First paragraph.\n\nSecond paragraph.',
            reflectionQuestion: 'Where has he led you?',
            application: 'Call a friend.',
            prayerPrompt: 'Thank him.',
            notes: 'A psalm of David.',
          }),
        ],
      });
      const devotional = screen.getByTestId('plan-preview-devotional');
      expect(devotional).toHaveTextContent('First paragraph.');
      expect(devotional).toHaveTextContent('Second paragraph.');
      // Two paragraphs, not one run-on.
      expect(within(devotional).getAllByText(/paragraph\./)).toHaveLength(2);
      expect(screen.getByTestId('plan-preview-question')).toHaveTextContent(
        'Where has he led you?'
      );
      expect(screen.getByTestId('plan-preview-application')).toHaveTextContent(
        'Call a friend.'
      );
      expect(screen.getByTestId('plan-preview-prayer')).toHaveTextContent('Thank him.');
      expect(screen.getByTestId('plan-preview-notes')).toHaveTextContent(
        'A psalm of David.'
      );
    });

    it('leaves out a section with nothing in it, so a bare day still looks right', () => {
      setup({ days: [day('Bare')] });
      for (const id of [
        'plan-preview-devotional',
        'plan-preview-question',
        'plan-preview-application',
        'plan-preview-prayer',
        'plan-preview-notes',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });

    it('writes several passages as the app stores them', () => {
      setup({ days: [day('Two', { passages: ['psalm 23', 'John 3:16'] })] });
      expect(screen.getByTestId('plan-preview-reference')).toHaveTextContent(
        'Psalm 23; John 3:16'
      );
    });

    it('shows a day with no reading or title honestly', () => {
      setup({ days: [blankDay('x')] });
      expect(screen.getByTestId('plan-preview-reference')).toHaveTextContent(
        'No reading yet'
      );
      expect(screen.getByTestId('plan-preview-day-title')).toHaveTextContent(
        'Untitled day'
      );
    });

    it('asks for a day when there are none', () => {
      setup({ days: [] });
      expect(screen.getByTestId('plan-preview-no-days')).toHaveTextContent(
        'Add a day to preview it.'
      );
      expect(screen.queryByTestId('plan-preview-day-select')).not.toBeInTheDocument();
    });

    it('previews whichever day is chosen', async () => {
      const user = userEvent.setup();
      setup({
        days: [
          day('First', { devotional: 'One.' }),
          day('Second', { devotional: 'Two.' }),
        ],
      });
      expect(screen.getByTestId('plan-preview-day-title')).toHaveTextContent('First');
      await user.click(screen.getByRole('combobox', { name: 'Day' }));
      await user.click(screen.getByRole('option', { name: 'Day 2' }));
      expect(screen.getByTestId('plan-preview-day-title')).toHaveTextContent('Second');
      expect(screen.getByTestId('plan-preview-devotional')).toHaveTextContent('Two.');
    });

    it('falls back to the last day when the chosen day is removed', async () => {
      const user = userEvent.setup();
      const days = [day('First'), day('Second')];
      const { rerender } = setup({ days });
      await user.click(screen.getByRole('combobox', { name: 'Day' }));
      await user.click(screen.getByRole('option', { name: 'Day 2' }));
      rerender(
        <ThemeProvider theme={theme}>
          <PlanPreviewTab details={DETAILS} days={[days[0]!]} visibleToMembers={false} />
        </ThemeProvider>
      );
      expect(screen.getByTestId('plan-preview-day-title')).toHaveTextContent('First');
      expect(screen.getByTestId('plan-preview-day')).toHaveTextContent('Day 1 of 1');
    });
  });
});
