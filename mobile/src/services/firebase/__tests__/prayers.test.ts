import { addDoc, deleteDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { createPrayer, deletePrayer, setPrayerAnswered, subscribeToPrayers } from '../prayers';

jest.mock('../app');

describe('prayers service', () => {
  afterEach(() => jest.clearAllMocks());

  describe('subscribeToPrayers', () => {
    it('maps snapshot docs into Prayer objects', () => {
      const onNext = jest.fn();
      const onError = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
        next({
          docs: [
            {
              id: 'p1',
              data: () => ({
                text: 'Please pray for healing.',
                answered: false,
                createdAt: new Timestamp(1000, 0),
                answeredAt: null,
              }),
            },
          ],
        });
        return jest.fn();
      });

      subscribeToPrayers('uid-1', onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1', text: 'Please pray for healing.', answered: false }),
      ]);
    });

    it('forwards Firestore errors to onError', () => {
      const onNext = jest.fn();
      const onError = jest.fn();
      const error = { code: 'permission-denied' };
      (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
        err(error);
        return jest.fn();
      });

      subscribeToPrayers('uid-1', onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('createPrayer', () => {
    it('writes trimmed text, defaulting answered to false', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'new-id' });
      const id = await createPrayer('uid-1', '  Thank you Lord.  ');
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ text: 'Thank you Lord.', answered: false, answeredAt: null })
      );
    });
  });

  describe('setPrayerAnswered', () => {
    it('sets answeredAt when marking answered', async () => {
      await setPrayerAnswered('uid-1', 'p1', true);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ answered: true })
      );
      const [, payload] = (updateDoc as jest.Mock).mock.calls[0];
      expect(payload.answeredAt).not.toBeNull();
    });

    it('clears answeredAt when marking unanswered', async () => {
      await setPrayerAnswered('uid-1', 'p1', false);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ answered: false, answeredAt: null })
      );
    });
  });

  describe('deletePrayer', () => {
    it('deletes the document', async () => {
      await deletePrayer('uid-1', 'p1');
      expect(deleteDoc).toHaveBeenCalled();
    });
  });
});
