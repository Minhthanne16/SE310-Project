import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  RegistrationError,
  type StudentTopicService,
} from '@/features/topics/services/topicApiService';
import { TopicNotFoundError } from '@/features/topics/services/topicService';
import type {
  MyRegistration,
  RegistrationGroup,
  TopicDetailDto,
  TopicMember,
  TopicRoundInfo,
} from '@/types/topic';
import { StudentTopicDetailPage } from './StudentTopicDetailPage';

afterEach(cleanup);

const ME = 'sv1';

const roundInfo: TopicRoundInfo = {
  roundId: 'r1',
  roundName: 'Văn bằng 1 · HK1',
  roundStatus: 'Đang diễn ra',
  topicsPublishedAt: '2026-11-11T02:00:00Z',
  submissionStart: '2026-11-01',
  submissionEnd: '2026-11-10',
  registrationEnd: '2026-11-20',
  canSubmit: false,
  submitBlockedReason: null,
};

const member = (
  id: string,
  code: string,
  name: string,
  representative = false,
): TopicMember => ({ id, code, name, className: 'KTPM2022', representative });

const me = member(ME, '22520001', 'Nguyễn Văn An', true);
const partner = member('sv2', '22520002', 'Lê Thị Bích');

const topic = (overrides: Partial<TopicDetailDto> = {}): TopicDetailDto => ({
  id: 't1',
  roundId: 'r1',
  code: 'DT-001',
  title: 'Hệ thống gợi ý khóa học',
  field: 'Trí tuệ nhân tạo',
  description: 'Gợi ý theo lịch sử học tập',
  requirements: 'Biết Python',
  supervisor: { id: 'gv1', code: 'GV0001', name: 'Trần Thị Bình' },
  source: 'GV công bố',
  status: 'Chưa đăng ký',
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  group: [],
  history: [],
  ...overrides,
});

const group = (
  representativeId = ME,
  members: TopicMember[] = [me, partner],
): RegistrationGroup => ({ id: 'g1', representativeId, members });

const mine = (overrides: Partial<MyRegistration> = {}): MyRegistration => ({
  round: roundInfo,
  registrationOpen: true,
  group: null,
  topic: null,
  canCancel: false,
  history: [],
  ...overrides,
});

const registeredHere = (overrides: Partial<MyRegistration> = {}) =>
  mine({
    group: group(),
    topic: topic({ status: 'Đã đăng ký', group: [me, partner] }),
    canCancel: true,
    history: [
      {
        topicId: 't1',
        topicCode: 'DT-001',
        topicTitle: 'Hệ thống gợi ý khóa học',
        registeredAt: '2026-11-12T03:00:00Z',
        registeredBy: 'Nguyễn Văn An',
        cancelledAt: null,
        cancelledBy: null,
      },
    ],
    ...overrides,
  });

const fakeService = (
  overrides: Partial<StudentTopicService> = {},
): StudentTopicService => ({
  listRounds: vi.fn(),
  listPublished: vi.fn(),
  get: vi.fn().mockResolvedValue(topic()),
  myRegistration: vi.fn().mockResolvedValue(mine()),
  register: vi.fn().mockResolvedValue(registeredHere()),
  cancel: vi.fn(),
  ...overrides,
});

const renderPage = (service: StudentTopicService, viewerId = ME) =>
  render(
    <StudentTopicDetailPage
      topicId="t1"
      viewerId={viewerId}
      service={service}
    />,
  );

it('shows the topic and lets a student without a group register as representative with a partner', async () => {
  const service = fakeService();
  renderPage(service);

  expect(
    await screen.findByRole('heading', { name: 'Hệ thống gợi ý khóa học' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Gợi ý theo lịch sử học tập')).toBeInTheDocument();
  expect(screen.getByText('Biết Python')).toBeInTheDocument();
  expect(screen.getByText(/Bạn sẽ là đại diện nhóm/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/MSSV thành viên thứ hai/), {
    target: { value: '22520002' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi danh' }));

  const dialog = await screen.findByRole('dialog', {
    name: 'Xác nhận ghi danh',
  });
  expect(within(dialog).getByText(/DT-001/)).toBeInTheDocument();
  expect(within(dialog).getByText(/22520002/)).toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Xác nhận ghi danh' }),
  );

  await waitFor(() =>
    expect(service.register).toHaveBeenCalledWith('t1', '22520002'),
  );
  expect(await screen.findByText('Đã ghi danh đề tài.')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Nhóm bạn đã ghi danh đề tài này' }),
  ).toBeInTheDocument();
  const members = screen.getByRole('list', { name: 'Thành viên nhóm' });
  expect(within(members).getByText(/Nguyễn Văn An/)).toBeInTheDocument();
  expect(within(members).getByText('Đại diện')).toBeInTheDocument();
  expect(within(members).getByText(/Lê Thị Bích/)).toBeInTheDocument();
});

it('registers alone without sending a member code', async () => {
  const service = fakeService();
  renderPage(service);

  fireEvent.click(await screen.findByRole('button', { name: 'Ghi danh' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Xác nhận ghi danh',
  });
  expect(within(dialog).getByText(/Đăng ký một mình/)).toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Xác nhận ghi danh' }),
  );

  await waitFor(() => expect(service.register).toHaveBeenCalledWith('t1', ''));
});

it('shows an invalid member code under the field and keeps the form', async () => {
  const service = fakeService({
    register: vi
      .fn()
      .mockRejectedValue(
        new RegistrationError(
          'Mã sinh viên 999 không tồn tại hoặc không thuộc đợt.',
          'member',
        ),
      ),
  });
  renderPage(service);

  const input = await screen.findByLabelText(/MSSV thành viên thứ hai/);
  fireEvent.change(input, { target: { value: '999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi danh' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Xác nhận ghi danh' }),
  );

  expect(
    await screen.findByText(
      'Mã sinh viên 999 không tồn tại hoặc không thuộc đợt.',
    ),
  ).toBeInTheDocument();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ghi danh' })).toBeEnabled();
});

it('tells the loser of a race the topic was just taken, reloads it and offers to go back to the list', async () => {
  const taken =
    'Đề tài vừa có nhóm khác nhận. Tải lại danh sách và chọn đề tài khác.';
  const get = vi
    .fn()
    .mockResolvedValueOnce(topic())
    .mockResolvedValue(topic({ status: 'Đã đăng ký' }));
  const service = fakeService({
    get,
    register: vi.fn().mockRejectedValue(new RegistrationError(taken, 'rule')),
  });
  renderPage(service);

  fireEvent.click(await screen.findByRole('button', { name: 'Ghi danh' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Xác nhận ghi danh' }),
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(taken);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(
    await screen.findByRole('heading', { name: 'Đề tài đã có nhóm' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Ghi danh' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Về danh sách đề tài' }),
  ).toHaveAttribute('href', '/sv/dang-ky');
});

it('hides registration when another group holds the topic', async () => {
  renderPage(
    fakeService({
      get: vi.fn().mockResolvedValue(topic({ status: 'Đã đăng ký' })),
    }),
  );

  expect(
    await screen.findByRole('heading', { name: 'Đề tài đã có nhóm' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Ghi danh' }),
  ).not.toBeInTheDocument();
});

it('lets a member who is not the representative cancel for the whole group after confirming', async () => {
  const cancelled = mine({
    group: group(),
    history: [
      {
        ...registeredHere().history[0],
        cancelledAt: '2026-11-13T03:00:00Z',
        cancelledBy: 'Lê Thị Bích',
      },
    ],
  });
  const service = fakeService({
    get: vi
      .fn()
      .mockResolvedValueOnce(
        topic({ status: 'Đã đăng ký', group: [me, partner] }),
      )
      .mockResolvedValue(topic()),
    myRegistration: vi.fn().mockResolvedValue(registeredHere()),
    cancel: vi.fn().mockResolvedValue(cancelled),
  });
  renderPage(service, 'sv2');

  fireEvent.click(await screen.findByRole('button', { name: 'Hủy ghi danh' }));
  const dialog = await screen.findByRole('alertdialog', {
    name: 'Hủy ghi danh cho cả nhóm?',
  });
  expect(dialog).toHaveTextContent(/áp dụng cho cả nhóm/);
  expect(dialog).toHaveTextContent(/Chưa đăng ký/);
  expect(dialog).toHaveTextContent(/giữ nguyên thành viên và đại diện/);

  // "Giữ ghi danh" đóng hộp, không gọi API.
  fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ ghi danh' }));
  expect(service.cancel).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Hủy ghi danh' }));
  fireEvent.click(
    within(
      await screen.findByRole('alertdialog', {
        name: 'Hủy ghi danh cho cả nhóm?',
      }),
    ).getByRole('button', { name: 'Hủy ghi danh' }),
  );

  await waitFor(() => expect(service.cancel).toHaveBeenCalledWith('t1'));
  expect(
    await screen.findByText('Đã hủy ghi danh cho cả nhóm.'),
  ).toBeInTheDocument();
  // Đề tài trống trở lại; nhóm cũ còn nhưng chỉ đại diện ghi danh lại.
  expect(
    await screen.findByText(/Chỉ đại diện nhóm \(Nguyễn Văn An\)/),
  ).toBeInTheDocument();
  const history = screen.getByRole('list', { name: 'Lịch sử ghi danh' });
  expect(history).toHaveTextContent(/Đã hủy .* bởi Lê Thị Bích/);
});

it('lets the representative register again with the same group and members', async () => {
  const service = fakeService({
    myRegistration: vi.fn().mockResolvedValue(mine({ group: group() })),
  });
  renderPage(service);

  expect(
    await screen.findByRole('list', { name: 'Thành viên nhóm' }),
  ).toHaveTextContent(/Lê Thị Bích/);
  expect(
    screen.queryByLabelText(/MSSV thành viên thứ hai/),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Ghi danh bằng nhóm này' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Xác nhận ghi danh' }),
  );

  await waitFor(() => expect(service.register).toHaveBeenCalledWith('t1', ''));
});

it('points a group that already holds another topic to it', async () => {
  renderPage(
    fakeService({
      myRegistration: vi.fn().mockResolvedValue(
        registeredHere({
          topic: topic({ id: 't9', code: 'DT-009', title: 'Phân tích log' }),
        }),
      ),
    }),
  );

  expect(
    await screen.findByRole('heading', { name: 'Bạn đã có nhóm' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /DT-009/ })).toHaveAttribute(
    'href',
    '/sv/dang-ky/t9',
  );
  expect(
    screen.queryByRole('button', { name: 'Ghi danh' }),
  ).not.toBeInTheDocument();
});

it('blocks registering and cancelling once the registration window closed', async () => {
  renderPage(
    fakeService({
      myRegistration: vi
        .fn()
        .mockResolvedValue(mine({ registrationOpen: false })),
    }),
  );
  expect(
    await screen.findByText(/Đã hết thời gian đăng ký đề tài của đợt/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Ghi danh' }),
  ).not.toBeInTheDocument();

  cleanup();
  renderPage(
    fakeService({
      get: vi
        .fn()
        .mockResolvedValue(topic({ status: 'Đang thực hiện', group: [me] })),
      myRegistration: vi
        .fn()
        .mockResolvedValue(
          registeredHere({ registrationOpen: false, canCancel: false }),
        ),
    }),
  );
  expect(
    await screen.findByRole('heading', {
      name: 'Nhóm bạn đã ghi danh đề tài này',
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Hủy ghi danh' }),
  ).not.toBeInTheDocument();
});

it('shows a rule error from a repeated cancel and refreshes the state', async () => {
  const myRegistration = vi
    .fn()
    .mockResolvedValueOnce(registeredHere())
    .mockResolvedValue(mine({ group: group() }));
  const service = fakeService({
    get: vi.fn().mockResolvedValue(topic({ status: 'Đã đăng ký' })),
    myRegistration,
    cancel: vi
      .fn()
      .mockRejectedValue(
        new RegistrationError('Nhóm không còn ghi danh đề tài này.', 'rule'),
      ),
  });
  renderPage(service);

  fireEvent.click(await screen.findByRole('button', { name: 'Hủy ghi danh' }));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Hủy ghi danh',
    }),
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nhóm không còn ghi danh đề tài này.',
  );
  await waitFor(() => expect(myRegistration).toHaveBeenCalledTimes(2));
});

it('shows not found for a topic the student cannot see', async () => {
  renderPage(
    fakeService({ get: vi.fn().mockRejectedValue(new TopicNotFoundError()) }),
  );
  expect(
    await screen.findByRole('heading', { name: 'Không tìm thấy đề tài' }),
  ).toBeInTheDocument();
});
