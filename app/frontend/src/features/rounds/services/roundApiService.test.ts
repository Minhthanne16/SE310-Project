import { afterEach, expect, it, vi } from 'vitest';
import { createApiRoundService } from './roundApiService';
import {
  DuplicateRoundNameError,
  RoundNotFoundError,
  RoundRuleError,
} from './roundService';
import { buildMilestones, seedRounds } from './roundSeed';
import { ApiError } from '@/api/request';

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

const failure = (message: string) => ({
  success: false,
  message,
  data: null,
});

it('calls the round endpoints with the expected method, URL and body', async () => {
  const fetchMock = stubFetch();
  const service = createApiRoundService();
  const input = {
    name: 'Văn bằng 1 · HK2',
    program: 'Văn bằng 1' as const,
    periodLabel: 'HK2',
    copyFromId: 'r 1',
  };
  const milestones = buildMilestones([]);

  await service.list();
  await service.list({
    status: 'Đang diễn ra',
    program: 'Thạc sĩ',
    search: ' hk1 ',
  });
  await service.list({ status: 'Tất cả', program: '', search: '' });
  await service.get('r 1');
  await service.create(input);
  await service.update('r 1', input);
  await service.updateMilestones('r 1', milestones);
  await service.open('a');
  await service.finish('a');
  await service.remove('a');
  await service.listParticipants('lecturer');
  await service.listCandidates('a', 'student');
  await service.checkParticipants('a', 'lecturer', ['CB101']);
  await service.addParticipants('a', 'student', ['22520001']);
  await service.removeParticipant('a', 'student', 'u/1');

  const calls = fetchMock.mock.calls.map(([url, init]) => [
    url,
    init?.method ?? 'GET',
    init?.body,
  ]);
  expect(calls).toEqual([
    ['/api/rounds', 'GET', undefined],
    [
      `/api/rounds?status=${encodeURIComponent('Đang diễn ra')}&program=${encodeURIComponent('Thạc sĩ')}&search=hk1`,
      'GET',
      undefined,
    ],
    ['/api/rounds', 'GET', undefined],
    ['/api/rounds/r%201', 'GET', undefined],
    ['/api/rounds', 'POST', JSON.stringify(input)],
    [
      '/api/rounds/r%201',
      'PUT',
      JSON.stringify({
        name: input.name,
        program: input.program,
        periodLabel: input.periodLabel,
      }),
    ],
    ['/api/rounds/r%201/milestones', 'PUT', JSON.stringify({ milestones })],
    ['/api/rounds/a/open', 'POST', undefined],
    ['/api/rounds/a/finish', 'POST', undefined],
    ['/api/rounds/a', 'DELETE', undefined],
    ['/api/rounds/people/lecturers', 'GET', undefined],
    ['/api/rounds/a/students/candidates', 'GET', undefined],
    [
      '/api/rounds/a/lecturers/check',
      'POST',
      JSON.stringify({ codes: ['CB101'] }),
    ],
    ['/api/rounds/a/students', 'POST', JSON.stringify({ codes: ['22520001'] })],
    ['/api/rounds/a/students/u%2F1', 'DELETE', undefined],
  ]);
});

it('returns the data of the response and today as a local date', async () => {
  const round = seedRounds()[0];
  stubFetch(200, { success: true, message: '', data: round });
  const service = createApiRoundService();
  expect(await service.get(round.id)).toEqual(round);
  expect(service.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('maps 404 to RoundNotFoundError', async () => {
  stubFetch(404, failure('Không tìm thấy đợt.'));
  const service = createApiRoundService();
  await expect(service.get('x')).rejects.toBeInstanceOf(RoundNotFoundError);
  await expect(service.open('x')).rejects.toBeInstanceOf(RoundNotFoundError);
});

it('maps 409 to DuplicateRoundNameError on create and update only for the duplicate name', async () => {
  const input = {
    name: 'Văn bằng 1 · X',
    program: 'Văn bằng 1' as const,
    periodLabel: 'X',
  };
  const duplicate = failure(new DuplicateRoundNameError().message);
  stubFetch(409, duplicate);
  const service = createApiRoundService();
  await expect(service.create(input)).rejects.toBeInstanceOf(
    DuplicateRoundNameError,
  );
  await expect(service.update('a', input)).rejects.toBeInstanceOf(
    DuplicateRoundNameError,
  );
  // Nơi khác không phải thao tác đặt tên: vẫn là lỗi quy tắc.
  await expect(service.open('a')).rejects.toBeInstanceOf(RoundRuleError);
});

it('maps other 409 to RoundRuleError with the server message', async () => {
  stubFetch(409, failure('Chưa mở được đợt: Đề cương: chưa đặt ngày.'));
  const service = createApiRoundService();
  const err = await service.open('a').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(RoundRuleError);
  expect((err as Error).message).toBe(
    'Chưa mở được đợt: Đề cương: chưa đặt ngày.',
  );
});

it('keeps other API errors as they are', async () => {
  stubFetch(403, failure('Bạn không có quyền.'));
  const service = createApiRoundService();
  const err = await service.list().catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(403);
});
