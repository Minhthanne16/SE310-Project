import { afterEach, expect, it, vi } from 'vitest';
import {
  createReviewerService,
  ReviewerConflictError,
} from './reviewerService';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (
  status = 200,
  body: unknown = { success: true, message: '', data: null },
) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

it('calls the reviewer endpoints with the expected method, URL and body', async () => {
  const fetchMock = stubFetch();
  const service = createReviewerService();

  await service.list('r 1');
  await service.suggest('r1');
  await service.assign('t1', 'gv1', null);
  await service.assign('t1', 'gv2', 'gv1');
  await service.batch('r1', [
    { topicId: 't1', reviewerId: 'gv1', expectedReviewerId: null },
  ]);
  await service.mine();
  await service.mine('r1');

  const calls = fetchMock.mock.calls.map(([url, init]) => [
    url,
    init?.method ?? 'GET',
    init?.body,
  ]);
  expect(calls).toEqual([
    ['/api/reviewer-assignments?roundId=r%201', 'GET', undefined],
    ['/api/reviewer-assignments/suggestions?roundId=r1', 'GET', undefined],
    [
      '/api/reviewer-assignments/t1',
      'PUT',
      '{"reviewerId":"gv1","expectedReviewerId":null}',
    ],
    [
      '/api/reviewer-assignments/t1',
      'PUT',
      '{"reviewerId":"gv2","expectedReviewerId":"gv1"}',
    ],
    [
      '/api/reviewer-assignments/batch',
      'POST',
      '{"roundId":"r1","items":[{"topicId":"t1","reviewerId":"gv1","expectedReviewerId":null}]}',
    ],
    ['/api/reviewer-assignments/mine', 'GET', undefined],
    ['/api/reviewer-assignments/mine?roundId=r1', 'GET', undefined],
  ]);
});

it('maps 409 on assign to ReviewerConflictError with the server message', async () => {
  stubFetch(409, {
    success: false,
    message: 'Phân công vừa thay đổi, tải lại',
    data: null,
  });
  const promise = createReviewerService().assign('t1', 'gv1', null);
  await expect(promise).rejects.toBeInstanceOf(ReviewerConflictError);
  await expect(promise).rejects.toThrow('Phân công vừa thay đổi, tải lại');
});

it('lets other errors through unchanged', async () => {
  stubFetch(404, { success: false, message: 'Không tìm thấy đề tài.' });
  await expect(
    createReviewerService().assign('t1', 'gv1', null),
  ).rejects.not.toBeInstanceOf(ReviewerConflictError);
});
