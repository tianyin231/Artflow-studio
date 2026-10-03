import { handleApiError } from '../../services/api/error-handler';

describe('API error responses', () => {
  it('preserves the error string returned by account and publisher routes', () => {
    const error = handleApiError({
      isAxiosError: true,
      response: { status: 500, statusText: 'Internal Server Error', data: { error: 'Pixiv CLI could not load accounts' } },
    });
    expect(error.message).toBe('Pixiv CLI could not load accounts');
    expect(error.statusCode).toBe(500);
  });

  it('prefers a structured message and does not stringify unexpected payloads', () => {
    const response = { status: 400, statusText: 'Bad Request', data: { message: 'Login expired', error: { token: 'private' } } };
    expect(handleApiError({ isAxiosError: true, response }).message).toBe('Login expired');
    expect(handleApiError({ isAxiosError: true, response: { ...response, data: { error: { token: 'private' } } } }).message).toBe('Bad Request');
  });
});
