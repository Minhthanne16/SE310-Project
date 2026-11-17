import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import { createCouncilService, CouncilConflictError } from './councilService';
import type { CouncilInput } from '@/types/council';

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

const input: CouncilInput = {
  roundId: 'r1',
  name: 'Hội đồng 1',
  chairId: 'gv1',
  secretaryId: 'gv2',
  date: '2026-10-14',
  room: 'B4.12',
  slots: [{ topicId: 't1', start: '07:30', end: '08:15' }],
};

it('gọi đúng method, URL và body của /api/councils', async () => {
  const fetchMock = stubFetch();
  const service = createCouncilService();

  await service.board('r 1');
  await service.check(input, null);
  await service.check(input, 'c1');
  await service.create(input);
  await service.update('c1', {
    ...input,
    expectedVersion: 2,
    reason: 'Đổi phòng',
  });
  await service.remove('c1');
  await service.publish('r1');
  await service.publish('r1', ['c1']);
  await service.cancel('c1', 'Không đủ người');
  await service.correct('c1', 'Phòng B4.12A', 'Ghi nhầm');
  await service.mine();
  await service.mine('r1');

  const calls = fetchMock.mock.calls.map(([url, init]) => [
    url,
    init?.method ?? 'GET',
    init?.body ? JSON.parse(init.body as string) : undefined,
  ]);
  expect(calls).toEqual([
    ['/api/councils?roundId=r%201', 'GET', undefined],
    ['/api/councils/check', 'POST', { ...input, councilId: null }],
    ['/api/councils/check', 'POST', { ...input, councilId: 'c1' }],
    ['/api/councils', 'POST', input],
    [
      '/api/councils/c1',
      'PUT',
      { ...input, expectedVersion: 2, reason: 'Đổi phòng' },
    ],
    ['/api/councils/c1', 'DELETE', undefined],
    ['/api/councils/publish', 'POST', { roundId: 'r1', councilIds: null }],
    ['/api/councils/publish', 'POST', { roundId: 'r1', councilIds: ['c1'] }],
    ['/api/councils/c1/cancel', 'POST', { reason: 'Không đủ người' }],
    [
      '/api/councils/c1/corrections',
      'POST',
      { content: 'Phòng B4.12A', reason: 'Ghi nhầm' },
    ],
    ['/api/councils/mine', 'GET', undefined],
    ['/api/councils/mine?roundId=r1', 'GET', undefined],
  ]);
});

it('đổi 409 thành CouncilConflictError với thông điệp máy chủ (gộp errors[])', async () => {
  stubFetch(409, {
    success: false,
    message: 'Chưa lưu được: còn 2 vấn đề cần xử lý.',
    data: null,
    errors: [
      'Phòng B4.12 trùng giờ với Hội đồng 2 (07:30–09:00).',
      'TS. Trần Minh Khoa trùng giờ với Hội đồng 2 (07:30–09:00).',
    ],
  });
  const promise = createCouncilService().create(input);
  await expect(promise).rejects.toBeInstanceOf(CouncilConflictError);
  await expect(promise).rejects.toThrow(
    'Phòng B4.12 trùng giờ với Hội đồng 2 (07:30–09:00). TS. Trần Minh Khoa',
  );
});

it('giữ lỗi khác 409 (400, 403, 404) dưới dạng ApiError', async () => {
  stubFetch(400, {
    success: false,
    message: 'Validation failed',
    data: null,
    errors: ['Nhập lý do hủy lịch.'],
  });
  const promise = createCouncilService().cancel('c1', '');
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.not.toBeInstanceOf(CouncilConflictError);
  await expect(promise).rejects.toThrow('Nhập lý do hủy lịch.');
});
