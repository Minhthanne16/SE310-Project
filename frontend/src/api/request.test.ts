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
