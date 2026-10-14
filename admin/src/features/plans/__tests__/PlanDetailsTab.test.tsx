import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryUpload')>()),
  uploadToCloudinary: vi.fn(),
}));
vi.mock('../../../services/firebase/mediaAssets', () => ({
  createMediaAsset: vi.fn().mockResolvedValue('lib-1'),
  assetFromUpload: vi.fn((uploaded, details) => ({ uploaded, details })),
  subscribeToMediaAssets: vi.fn(() => vi.fn()),
}));

import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { uploadToCloudinary } from '../../../services/media/cloudinaryUpload';
import { useAuthStore } from '../../../store/authStore';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
  deferred,
  fileOf,
  renderThemed,
} from '../../../components/media/__tests__/helpers';
import { PlanDetailsTab } from '../PlanDetailsTab';
import { emptyDetails, validatePlanDetails, type PlanDetailsForm } from '../planDetails';
import type { UploadedAsset } from '../../../services/media/types';

const DETAILS: PlanDetailsForm = {
  ...emptyDetails(),
  title: 'Seven Days in the Psalms',
  description: 'A week of psalms.',
};

function setup(props: Partial<React.ComponentProps<typeof PlanDetailsTab>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onChangePlanId: vi.fn(),
    onUploadingChange: vi.fn(),
  };
  const details = props.details ?? DETAILS;
  renderThemed(
    <PlanDetailsTab
      details={details}
      errors={validatePlanDetails(details)}
      planId="seven-days-in-the-psalms"
      mode="create"
      idError={null}
      readOnly={false}
      showErrors={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

describe('PlanDetailsTab', () => {
  it('shows the plan as it is', () => {
    setup({
      details: {
        ...DETAILS,
        subtitle: 'Rest for the weary',
        estimatedMinutes: '12',
        author: 'Pastor Samuel',
        order: '3',
        language: 'te',
      },
    });
    expect(screen.getByTestId('plan-title')).toHaveValue('Seven Days in the Psalms');
    expect(screen.getByTestId('plan-subtitle')).toHaveValue('Rest for the weary');
    expect(screen.getByTestId('plan-description')).toHaveValue('A week of psalms.');
    expect(screen.getByTestId('plan-category')).toHaveValue('Devotional');
    expect(screen.getByTestId('plan-minutes')).toHaveValue(12);
    expect(screen.getByTestId('plan-author')).toHaveValue('Pastor Samuel');
    expect(screen.getByTestId('plan-order')).toHaveValue(3);
    expect(screen.getByRole('combobox', { name: /Language/ })).toHaveTextContent('Telugu');
  });

  it.each([
    ['plan-title', 'title'],
    ['plan-subtitle', 'subtitle'],
    ['plan-description', 'description'],
    ['plan-minutes', 'estimatedMinutes'],
    ['plan-author', 'author'],
    ['plan-order', 'order'],
  ])('reports a change to %s as a change to %s', (testId, field) => {
    const { onChange } = setup();
    const value = testId === 'plan-minutes' || testId === 'plan-order' ? '7' : 'Words';
    fireEvent.change(screen.getByTestId(testId), { target: { value } });
    expect(onChange).toHaveBeenCalledWith(field, value);
  });

  it('chooses a language from the languages the app supports, and only those', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole('combobox', { name: /Language/ }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['English', 'Telugu']);
    await user.click(screen.getByRole('option', { name: 'Telugu' }));
    expect(onChange).toHaveBeenCalledWith('language', 'te');
  });

  it('accepts a category of the administrator\'s own', () => {
    const { onChange } = setup({ details: { ...DETAILS, category: '' } });
    fireEvent.change(screen.getByTestId('plan-category'), { target: { value: 'Lent' } });
    expect(onChange).toHaveBeenLastCalledWith('category', 'Lent');
  });

  it('suggests categories to choose from', async () => {
    const user = userEvent.setup();
    setup({ details: { ...DETAILS, category: '' } });
    await user.click(screen.getByTestId('plan-category'));
    const suggestions = screen.getAllByRole('option').map((option) => option.textContent);
    expect(suggestions).toContain('Devotional');
    expect(suggestions).toContain('Book study');
  });

  describe('the plan ID', () => {
    it('is typed over while the plan is new', () => {
      const { onChangePlanId } = setup();
      fireEvent.change(screen.getByTestId('plan-id'), { target: { value: 'my-plan' } });
      expect(onChangePlanId).toHaveBeenCalledWith('my-plan');
      expect(screen.getByTestId('plan-id')).not.toHaveAttribute('readonly');
      expect(screen.getByText(/It cannot be changed after the plan is saved/)).toBeInTheDocument();
    });

    it('is shown, read-only, with a copy button once the plan exists', () => {
      setup({ mode: 'edit' });
      expect(screen.getByTestId('plan-id')).toHaveAttribute('readonly');
      expect(screen.getByTestId('plan-id')).toHaveValue('seven-days-in-the-psalms');
      expect(screen.getByText(/This ID cannot be changed/)).toBeInTheDocument();
      expect(screen.getByTestId('plan-id-copy')).toBeInTheDocument();
    });

    it('has no copy button while the plan is new', () => {
      setup();
      expect(screen.queryByTestId('plan-id-copy')).not.toBeInTheDocument();
    });

    it('copies the ID to the clipboard and says so', async () => {
      const user = userEvent.setup();
      // user-event installs its own clipboard on `navigator`; read it back.
      setup({ mode: 'edit' });
      await user.click(screen.getByTestId('plan-id-copy'));
      expect(await navigator.clipboard.readText()).toBe('seven-days-in-the-psalms');
      expect(await screen.findByLabelText('Copy plan ID')).toBeInTheDocument();
    });

    it('says what is wrong with a bad ID, once there is something to say it about', () => {
      setup({ planId: 'Bad ID!' });
      expect(
        screen.getByText(/only lowercase letters, numbers and single hyphens/)
      ).toBeInTheDocument();
      expect(screen.getByTestId('plan-id')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not scold an empty ID before a save is attempted', () => {
      setup({ planId: '' });
      expect(screen.getByTestId('plan-id')).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('asks for an ID after a save is attempted', () => {
      setup({ planId: '', showErrors: true });
      expect(screen.getByText(/Choose an ID for this plan/)).toBeInTheDocument();
    });

    it('says an ID is taken when Firestore says so', () => {
      setup({ idError: 'The ID "seven-days" is already used by another plan.' });
      expect(screen.getByText(/already used by another plan/)).toBeInTheDocument();
    });

    it('does not show an ID problem on an existing plan', () => {
      setup({ mode: 'edit', planId: 'Bad ID!' });
      expect(screen.getByTestId('plan-id')).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('what it says is wrong', () => {
    it('shows a missing title', () => {
      setup({ details: { ...DETAILS, title: '' } });
      expect(screen.getByText('Give the plan a title.')).toBeInTheDocument();
      expect(screen.getByTestId('plan-title')).toHaveAttribute('aria-invalid', 'true');
    });

    it('asks for a description only after a save is attempted', () => {
      setup({ details: { ...DETAILS, description: '' } });
      expect(screen.getByTestId('plan-description')).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('asks for a description once a save has been attempted', () => {
      setup({ details: { ...DETAILS, description: '' }, showErrors: true });
      expect(screen.getByTestId('plan-description')).toHaveAttribute('aria-invalid', 'true');
      expect(
        screen.getByText('Write a short description. It is what members read before they start.')
      ).toBeInTheDocument();
    });

    it('counts the description against its limit', () => {
      setup();
      expect(screen.getByText(/17 \/ 2,000/)).toBeInTheDocument();
    });

    it('rejects minutes that are not a whole number in range', () => {
      setup({ details: { ...DETAILS, estimatedMinutes: '999' } });
      expect(screen.getByText(/whole number of minutes from 1 to 240/)).toBeInTheDocument();
    });

    it('rejects a display order that is not a whole number', () => {
      setup({ details: { ...DETAILS, order: '1.5' } });
      expect(screen.getByText('Use a whole number. Lower numbers appear first.')).toBeInTheDocument();
    });
  });

  it('can be looked at but not changed by a reader without permission', () => {
    setup({ readOnly: true, mode: 'edit' });
    for (const id of ['plan-title', 'plan-subtitle', 'plan-description', 'plan-category', 'plan-minutes', 'plan-author', 'plan-order']) {
      expect(screen.getByTestId(id)).toBeDisabled();
    }
    expect(screen.getByRole('combobox', { name: /Language/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByTestId('plan-cover-upload-button')).toBeDisabled();
  });

  describe('the cover image', () => {
    const upload = () => userEvent.setup({ applyAccept: false });

    it('uploads a picture and stores the address it comes back with', async () => {
      vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
      const { onChange } = setup();
      await upload().upload(
        screen.getByTestId('plan-cover-input'),
        fileOf('cover.jpg', 'image/jpeg')
      );
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith('coverImageUrl', UPLOADED_IMAGE.url)
      );
    });

    it('tells the editor while an upload is on its way, so Save can wait', async () => {
      const pending = deferred<UploadedAsset>();
      vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
      const { onUploadingChange } = setup();
      await upload().upload(
        screen.getByTestId('plan-cover-input'),
        fileOf('cover.jpg', 'image/jpeg')
      );
      await waitFor(() => expect(onUploadingChange).toHaveBeenCalledWith(true));
      pending.resolve(UPLOADED_IMAGE);
      await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
    });

    it('turns away a file that is not a picture, before uploading anything', async () => {
      const { onChange } = setup();
      await upload().upload(
        screen.getByTestId('plan-cover-input'),
        fileOf('notes.pdf', 'application/pdf')
      );
      expect(uploadToCloudinary).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalledWith('coverImageUrl', expect.anything());
      expect(await screen.findByTestId('plan-cover-error')).toBeInTheDocument();
    });

    it('removes the cover', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({
        details: { ...DETAILS, coverImageUrl: UPLOADED_IMAGE.url },
      });
      await user.click(screen.getByTestId('plan-cover-remove'));
      expect(onChange).toHaveBeenCalledWith('coverImageUrl', null);
    });

    it('says how to set up uploads when they are not set up, and still takes an address', () => {
      vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
      setup();
      expect(screen.getByTestId('plan-cover-setup')).toBeInTheDocument();
      expect(screen.queryByTestId('plan-cover-upload-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-cover-url-input')).toBeInTheDocument();
    });
  });
});
