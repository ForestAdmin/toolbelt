import {
  LayoutApiError,
  extractDetail,
  toLayoutApiError,
} from '../../../src/services/layout/errors';

describe('layout errors', () => {
  describe('extractDetail', () => {
    it('reads the first JSON:API error detail', () => {
      expect.assertions(1);
      expect(extractDetail({ errors: [{ detail: 'boom' }, { detail: 'ignored' }] })).toBe('boom');
    });

    it('falls back to the first error message when detail is absent', () => {
      expect.assertions(1);
      expect(extractDetail({ errors: [{ message: 'msg' }] })).toBe('msg');
    });

    it('falls back to a top-level message', () => {
      expect.assertions(1);
      expect(extractDetail({ message: 'top-level' })).toBe('top-level');
    });

    it('returns a raw string body as-is', () => {
      expect.assertions(1);
      expect(extractDetail('raw text')).toBe('raw text');
    });

    it('returns a placeholder for an empty/unknown body', () => {
      expect.assertions(2);
      expect(extractDetail(undefined)).toBe('no response body');
      expect(extractDetail('')).toBe('no response body');
    });
  });

  describe('toLayoutApiError', () => {
    it('maps a superagent error to status + JSON:API detail', () => {
      expect.assertions(3);
      const error = toLayoutApiError({
        status: 422,
        response: { body: { errors: [{ detail: 'bad path' }] } },
      });
      expect(error).toBeInstanceOf(LayoutApiError);
      expect(error.status).toBe(422);
      expect(error.detail).toBe('bad path');
    });

    it('defaults the status to 0 when the request never reached the server', () => {
      expect.assertions(2);
      const error = toLayoutApiError(new Error('ECONNREFUSED'));
      expect(error.status).toBe(0);
      expect(error.detail).toBe('no response body');
    });

    it('uses the response text when there is no parsed body', () => {
      expect.assertions(1);
      const error = toLayoutApiError({ status: 500, response: { text: 'Internal Server Error' } });
      expect(error.detail).toBe('Internal Server Error');
    });
  });
});
