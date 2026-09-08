import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeToChurchSettings } from '../settings';

jest.mock('../app');

describe('subscribeToChurchSettings', () => {
  afterEach(() => jest.clearAllMocks());

  it('subscribes to the settings/church document', () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    subscribeToChurchSettings(jest.fn(), jest.fn());
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'settings', 'church');
  });

  it('maps an existing document into a ChurchSettings', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        data: () => ({
          churchName: 'Bethaniya Ministries',
          logoUrl: 'https://example.com/logo.png',
          description: 'A community of faith.',
          supportEmail: 'support@example.com',
        }),
      });
      return jest.fn();
    });

    subscribeToChurchSettings(onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith({
      churchName: 'Bethaniya Ministries',
      logoUrl: 'https://example.com/logo.png',
      description: 'A community of faith.',
      supportEmail: 'support@example.com',
    });
  });

  it('calls onNext with null when the document does not exist', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => false, data: () => undefined });
      return jest.fn();
    });

    subscribeToChurchSettings(onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('defaults missing/non-string fields to empty strings rather than throwing', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ churchName: 'Only Name Set' }) });
      return jest.fn();
    });

    subscribeToChurchSettings(onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith({
      churchName: 'Only Name Set',
      logoUrl: '',
      description: '',
      supportEmail: '',
    });
  });

  it('forwards a subscription error to onError', () => {
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock).mockImplementation((_ref, _next, onErr) => {
      onErr(error);
      return jest.fn();
    });

    subscribeToChurchSettings(jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
