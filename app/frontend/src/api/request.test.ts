import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest } from './request';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: '', data: 1 }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

it('sends JSON requests with a JSON content type', async () => {
  const fetchMock = stubFetch();
  await apiRequest('/x', { method: 'POST', body: '{}' });
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
});

it('leaves the content type to the browser for FormData bodies', async () => {
  const fetchMock = stubFetch();
  const body = new FormData();
  body.append('file', new File(['a'], 'a.csv'));
  await apiRequest('/x', { method: 'POST', body });
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect(init.body).toBe(body);
  expect(init.headers).not.toHaveProperty('Content-Type');
});

const stubError = (status: number, body: object) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status, json: async () => body }),
  );

it('uses the errors array as the message when the backend sends one', async () => {
  stubError(400, {
    success: false,
    message: 'Validation failed',
    data: null,
    errors: ['Mật khẩu hiện tại không đúng.', 'Mật khẩu mới quá ngắn.'],
  });
  await expect(apiRequest('/x')).rejects.toMatchObject({
    status: 400,
    message: 'Mật khẩu hiện tại không đúng. Mật khẩu mới quá ngắn.',
  });
});

it('falls back to the message when errors is empty', async () => {
  stubError(409, {
    success: false,
    message: 'Trùng dữ liệu.',
    data: null,
    errors: [],
  });
  await expect(apiRequest('/x')).rejects.toMatchObject({
    message: 'Trùng dữ liệu.',
  });
});

it('keeps an ApiError when errors is a ProblemDetails object', async () => {
  stubError(400, {
    title: 'One or more validation errors occurred.',
    status: 400,
    errors: { '$.x': ['The JSON value could not be converted.'] },
  });
  await expect(apiRequest('/x')).rejects.toMatchObject({
    name: 'ApiError',
    status: 400,
    message: 'HTTP 400',
  });
});
