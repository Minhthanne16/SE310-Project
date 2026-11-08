import { afterEach, expect, it, vi } from 'vitest';
import type { RoundService } from '@/features/rounds/services/roundService';
import { TopicNotFoundError } from '@/features/topics/services/topicService';
import type { TopicDetailDto, TopicDto } from '@/types/topic';
import {
  createApiTopicService,
  createLecturerTopicService,
  createStudentTopicService,
  RegistrationError,
  TopicRuleError,
} from './topicApiService';

afterEach(() => vi.unstubAllGlobals());

const dto = (overrides: Partial<TopicDto> = {}): TopicDto => ({
  id: 't1',
  roundId: 'r1',
  code: 'DT-001',
  title: 'Hệ thống gợi ý',
  field: 'Trí tuệ nhân tạo',
  description: 'Mô tả',
  requirements: null,
  supervisor: { id: 'gv1', code: 'GV0001', name: 'Trần Thị Bình' },
  source: 'GV công bố',
  status: 'Chưa đăng ký',
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: null,
  canEdit: 'all',
  canDelete: true,
  group: [],
  ...overrides,
});

const roundInfo = {
  roundId: 'r1',
  roundName: 'Đợt 1',
  roundStatus: 'Đang diễn ra',
  topicsPublishedAt: null,
  submissionStart: '2026-11-01',
  submissionEnd: '2026-11-10',
  registrationEnd: '2026-11-20',
  canSubmit: true,
  submitBlockedReason: null,
};

const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const ok = (data: unknown) =>
  stubFetch(200, { success: true, message: '', data });

const sent = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method ?? 'GET',
    body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  };
};

const rounds = {} as RoundService;

it('lists the round topics, filters on the client and keys loads by lecturer', async () => {
  const fetchMock = ok({
    round: roundInfo,
    items: [dto(), dto({ id: 't2', code: 'DT-002', title: 'Mạng nơ-ron' })],
    loads: [{ lecturerId: 'gv1', count: 2, min: 1, max: 3, level: 'ok' }],
  });

  const list = await createApiTopicService(rounds).list({
    roundId: 'r1',
    search: 'mạng nơ',
  });

  expect(sent(fetchMock).url).toBe('/api/topics?roundId=r1');
  expect(list.roundTotal).toBe(2);
  expect(list.items.map((t) => t.code)).toEqual(['DT-002']);
  expect(list.items[0].group).toEqual([]);
  expect(list.loads.gv1.level).toBe('ok');
  expect(list.round.roundStatus).toBe('Đang diễn ra');
});

it('maps the history of one topic and turns 404 into TopicNotFoundError', async () => {
  const detail: TopicDetailDto = {
    ...dto(),
    history: [
      {
        id: 'h1',
        at: '2026-11-07T08:00:00Z',
        actor: 'Trần Thị Bình',
        category: 'Trạng thái',
        action: 'Gửi đề tài',
        detail: null,
      },
    ],
  };
  ok(detail);
  const topic = await createApiTopicService(rounds).get('t1');
  expect(topic.history[0]).toMatchObject({
    action: 'Gửi đề tài',
    detail: undefined,
  });

  stubFetch(404, {
    success: false,
    message: 'Không tìm thấy đề tài.',
    data: null,
  });
  await expect(createApiTopicService(rounds).get('x')).rejects.toBeInstanceOf(
    TopicNotFoundError,
  );
});

it('sends the lecturer form and maps rule errors', async () => {
  let fetchMock = ok(dto());
  await createLecturerTopicService().create('r1', {
    title: 'Hệ thống gợi ý',
    field: 'Trí tuệ nhân tạo',
    description: 'Mô tả',
    requirements: '  ',
  });
  expect(sent(fetchMock)).toEqual({
    url: '/api/topics',
    method: 'POST',
    body: {
      roundId: 'r1',
      title: 'Hệ thống gợi ý',
      field: 'Trí tuệ nhân tạo',
      description: 'Mô tả',
      requirements: null,
    },
  });

  fetchMock = ok(dto());
  await createLecturerTopicService().update('t1', {
    title: 'A',
    field: 'B',
    description: 'C',
    requirements: 'D',
  });
  expect(sent(fetchMock)).toMatchObject({
    url: '/api/topics/t1',
    method: 'PUT',
    body: { requirements: 'D' },
  });

  fetchMock = ok(true);
  await createLecturerTopicService().remove('t1');
  expect(sent(fetchMock)).toMatchObject({
    url: '/api/topics/t1',
    method: 'DELETE',
  });

  stubFetch(409, {
    success: false,
    message: 'Danh sách đề tài đã công bố nên không xóa được đề tài.',
    data: null,
  });
  const error = await createLecturerTopicService()
    .remove('t1')
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(TopicRuleError);
  expect((error as Error).message).toBe(
    'Danh sách đề tài đã công bố nên không xóa được đề tài.',
  );
});

it('reads my topics and the published list from their own endpoints', async () => {
  let fetchMock = ok({
    round: roundInfo,
    items: [],
    load: { lecturerId: 'gv1', count: 0, min: 0, max: 0, level: 'ok' },
  });
  await createLecturerTopicService().listMine('r1');
  expect(sent(fetchMock).url).toBe('/api/topics/mine?roundId=r1');

  fetchMock = ok({ round: roundInfo, items: [], loads: [] });
  await createStudentTopicService().listPublished('r1');
  expect(sent(fetchMock).url).toBe('/api/topics/published?roundId=r1');
});

it('maps the registered group with its representative', async () => {
  const member = {
    id: 'sv1',
    code: '22520001',
    name: 'Nguyễn Văn An',
    className: 'KTPM2022',
    representative: true,
  };
  ok({
    round: roundInfo,
    items: [dto({ status: 'Đã đăng ký', group: [member] })],
    loads: [],
  });
  const list = await createApiTopicService(rounds).list({ roundId: 'r1' });
  expect(list.items[0].group).toEqual([member]);
});

const mine = {
  round: roundInfo,
  registrationOpen: true,
  group: null,
  topic: null,
  canCancel: false,
  history: [],
};

it('follows the PDR-054 registration contract', async () => {
  const service = createStudentTopicService();

  let fetchMock = ok(mine);
  await service.myRegistration('r 1');
  expect(sent(fetchMock).url).toBe('/api/topics/my-registration?roundId=r%201');

  fetchMock = ok(mine);
  await service.register('t1', '  22520002 ');
  expect(sent(fetchMock)).toEqual({
    url: '/api/topics/t1/registration',
    method: 'POST',
    body: { memberCodes: ['22520002'] },
  });

  // Đăng ký một mình hoặc ghi danh lại bằng nhóm cũ: không gửi mã nào.
  fetchMock = ok(mine);
  await service.register('t1', '   ');
  expect(sent(fetchMock).body).toEqual({ memberCodes: [] });

  fetchMock = ok(mine);
  await service.cancel('t1');
  expect(sent(fetchMock)).toMatchObject({
    url: '/api/topics/t1/registration',
    method: 'DELETE',
  });

  fetchMock = ok(dto());
  await service.get('t1');
  expect(sent(fetchMock).url).toBe('/api/topics/t1');
});

it('splits registration errors into member and rule errors', async () => {
  const service = createStudentTopicService();
  const fail = (status: number, message: string) =>
    stubFetch(status, { success: false, message, data: null });

  fail(400, 'Mã sinh viên 999 không tồn tại hoặc không thuộc đợt.');
  const member = await service.register('t1', '999').catch((e: unknown) => e);
  expect(member).toBeInstanceOf(RegistrationError);
  expect(member).toMatchObject({
    kind: 'member',
    message: 'Mã sinh viên 999 không tồn tại hoặc không thuộc đợt.',
  });

  fail(
    409,
    'Đề tài vừa có nhóm khác nhận. Tải lại danh sách và chọn đề tài khác.',
  );
  await expect(service.register('t1', '')).rejects.toMatchObject({
    kind: 'rule',
    message:
      'Đề tài vừa có nhóm khác nhận. Tải lại danh sách và chọn đề tài khác.',
  });

  fail(403, 'Chỉ đại diện nhóm được ghi danh cho nhóm.');
  await expect(service.register('t1', '')).rejects.toMatchObject({
    kind: 'rule',
  });

  fail(409, 'Nhóm không còn ghi danh đề tài này.');
  await expect(service.cancel('t1')).rejects.toMatchObject({ kind: 'rule' });

  fail(404, 'Không tìm thấy đề tài.');
  await expect(service.cancel('t1')).rejects.toBeInstanceOf(TopicNotFoundError);
});
