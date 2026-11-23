import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetNavigation } from '@/test/navigationMock';
import {
  CouncilConflictError,
  type CouncilService,
} from '@/features/councils/services/councilService';
import type { Round } from '@/types/round';
import type {
  Council,
  CouncilBoard,
  CouncilPoolTopic,
  CouncilSlot,
} from '@/types/council';
import { CouncilBoardPage } from './CouncilBoardPage';
import { CouncilPanel } from './CouncilPanel';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu/hoi-dong'));
afterEach(cleanup);

const rounds = [{ id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra' }] as Round[];
const person = (id: string, name: string) => ({
  id,
  code: id.toUpperCase(),
  name,
});
const A = person('gva', 'GV A');
const B = person('gvb', 'GV B');
const C = person('gvc', 'GV C');
const D = person('gvd', 'GV D');

const slot = (
  topicId: string,
  start: string,
  end: string,
  order = 1,
): CouncilSlot => ({
  id: `s-${topicId}`,
  order,
  topicId,
  code: `DT-${topicId}`,
  title: `Đề tài ${topicId}`,
  group: [
    {
      ...person(`sv${topicId}`, `SV ${topicId}`),
      className: 'K1',
      representative: true,
    },
  ],
  supervisor: A,
  reviewer: null,
  start,
  end,
  thesisVersionCount: 1,
  finalLocked: false,
  status: 'active',
});

const council = (overrides: Partial<Council> = {}): Council => ({
  id: 'c1',
  roundId: 'r1',
  name: 'Hội đồng 1',
  status: 'Nháp',
  version: 1,
  chair: B,
  secretary: C,
  date: '2026-10-14',
  room: 'B4.12',
  publishedAt: null,
  cancelledAt: null,
  cancelReason: null,
  scored: false,
  slots: [slot('001', '07:30', '08:15')],
  conflicts: [],
  corrections: [],
  history: [
    {
      id: 'l1',
      at: '2026-10-01T03:00:00Z',
      actor: 'Giáo vụ',
      action: 'Tạo hội đồng',
      reason: null,
      detail: 'Hội đồng 1 · lượt: 1. DT-001 07:30–08:15',
    },
  ],
  canEdit: true,
  editBlockedReason: null,
  canDelete: true,
  canPublish: true,
  publishBlockedReason: null,
  canCancel: false,
  canCorrect: false,
  ...overrides,
});

const pool = (
  id: string,
  overrides: Partial<CouncilPoolTopic> = {},
): CouncilPoolTopic => ({
  topicId: id,
  code: `DT-${id}`,
  title: `Đề tài ${id}`,
  group: [],
  supervisor: A,
  reviewer: D,
  thesisVersionCount: 0,
  eligible: true,
  blockedReason: null,
  ...overrides,
});

const boardOf = (
  councils: Council[],
  topics: CouncilPoolTopic[] = [pool('002'), pool('003')],
): CouncilBoard => ({
  round: {
    id: 'r1',
    name: 'Đợt 1',
    status: 'Đang diễn ra',
    defenseStart: '2026-10-13',
    defenseEnd: '2026-10-18',
  },
  councils,
  pool: topics,
  lecturers: [A, B, C, D],
  stats: {
    councils: councils.length,
    total: 3,
    scheduled: councils.reduce((n, c) => n + c.slots.length, 0),
    unscheduled: topics.filter((t) => t.eligible).length,
    conflicts: councils.reduce((n, c) => n + c.conflicts.length, 0),
  },
});

function fakeService(
  board: CouncilBoard,
  overrides: Partial<CouncilService> = {},
) {
  const service: CouncilService = {
    board: vi.fn(async () => board),
    check: vi.fn(async () => ({ ok: true, problems: [] })),
    create: vi.fn(async (input) =>
      council({ id: 'c-new', name: input.name, slots: [] }),
    ),
    update: vi.fn(async (_id, input) => council({ name: input.name })),
    remove: vi.fn(async () => undefined),
    publish: vi.fn(async () => ({
      published: 1,
      skipped: 0,
      results: [
        {
          councilId: 'c1',
          name: 'Hội đồng 1',
          ok: true,
          message: 'Đã công bố.',
        },
      ],
    })),
    cancel: vi.fn(async () => council({ status: 'Đã hủy' })),
    correct: vi.fn(async () => council()),
    mine: vi.fn(),
    ...overrides,
  };
  return service;
}

const roundService = { list: vi.fn(async () => rounds) };

async function renderPage(service: CouncilService) {
  render(
    <CouncilPanel
      mode="edit"
      service={service}
      roundService={roundService}
      checkDelayMs={0}
    />,
  );
  const row = await screen.findByText('Hội đồng 1');
  fireEvent.click(row);
  await screen.findByRole('heading', { name: 'Hội đồng 1', level: 2 });
}

it.each(['2026-10-01', '2026-10-30'])(
  'cho phép lưu ngày %s ngoài mốc bảo vệ',
  async (date) => {
    const service = fakeService(boardOf([council()]));
    await renderPage(service);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const input = screen.getByLabelText('Ngày bảo vệ') as HTMLInputElement;
    fireEvent.change(input, { target: { value: date } });
    expect(input.checkValidity()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
    await waitFor(() =>
      expect(service.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ date }),
      ),
    );
  },
);

it.each(['Phòng', 'Giờ kết thúc DT-001'])(
  'bỏ kết quả kiểm tra cũ khi %s trở thành không hợp lệ',
  async (label) => {
    const pending = Promise.withResolvers<{
      ok: boolean;
      problems: string[];
    }>();
    const service = fakeService(boardOf([council()]), {
      check: vi.fn(() => pending.promise),
    });
    await renderPage(service);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    await waitFor(() => expect(service.check).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
    expect(
      screen.queryByText(/Đang kiểm tra trùng phòng/),
    ).not.toBeInTheDocument();
    await act(async () =>
      pending.resolve({ ok: false, problems: ['Xung đột cũ'] }),
    );
    expect(screen.queryByText('Xung đột cũ')).not.toBeInTheDocument();
    expect(service.check).toHaveBeenCalledTimes(1);
  },
);

it('bỏ phản hồi kiểm tra của form đã đóng khi mở form mới chưa đủ dữ liệu', async () => {
  const pending = Promise.withResolvers<{ ok: boolean; problems: string[] }>();
  const service = fakeService(boardOf([council()]), {
    check: vi.fn(() => pending.promise),
  });
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
  await waitFor(() => expect(service.check).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hội đồng' }));
  await act(async () =>
    pending.resolve({ ok: false, problems: ['Xung đột form đã đóng'] }),
  );
  expect(screen.queryByText('Xung đột form đã đóng')).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Đang kiểm tra trùng phòng/),
  ).not.toBeInTheDocument();
});

it('hiển thị thống kê, danh sách hội đồng, chi tiết, lịch sử và kho đề tài chưa xếp', async () => {
  const service = fakeService(
    boardOf(
      [council()],
      [
        pool('002'),
        pool('004', { eligible: false, blockedReason: 'Chưa duyệt đề cương' }),
      ],
    ),
  );
  await renderPage(service);

  expect(screen.getByText('Đề tài đã xếp lịch').nextSibling).toHaveTextContent(
    '1/3',
  );
  const list = screen.getByRole('region', { name: 'Danh sách hội đồng' });
  expect(
    within(list).getByText('14/10/2026 · 07:30–08:15 · B4.12'),
  ).toBeInTheDocument();
  expect(screen.getByText('GV B (GVB)')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'DT-001 · Đề tài 001' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai/001');
  expect(screen.getByText('Lịch sử thay đổi (1)')).toBeInTheDocument();
  expect(screen.getByText('Chưa duyệt đề cương')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xóa' })).toBeEnabled();
});

it('tạo hội đồng: báo lỗi thiếu trường tại chỗ, thêm đề tài từ kho, xem trước xung đột rồi lưu', async () => {
  const service = fakeService(boardOf([council()]));
  await renderPage(service);

  fireEvent.click(screen.getByRole('button', { name: 'Tạo hội đồng' }));
  expect(
    screen.getByRole('heading', { name: 'Tạo hội đồng' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Tên hội đồng')).toHaveValue('Hội đồng 2');
  expect(screen.getByLabelText('Ngày bảo vệ')).toHaveValue('13/10/2026');

  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  expect(screen.getByText('Chọn Chủ tịch.')).toHaveAttribute('role', 'alert');
  expect(screen.getByLabelText('Phòng')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(service.create).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Chủ tịch'), {
    target: { value: 'gvb' },
  });
  fireEvent.change(screen.getByLabelText('Thư ký (nhập điểm hội đồng)'), {
    target: { value: 'gvd' },
  });
  fireEvent.change(screen.getByLabelText('Phòng'), {
    target: { value: 'B4.14' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm DT-002 vào lịch' }));
  expect(screen.getByLabelText('Giờ bắt đầu DT-002')).toHaveValue('07:30');
  expect(screen.getByLabelText('Giờ kết thúc DT-002')).toHaveValue('08:15');

  expect(
    await screen.findByText('Không có xung đột với các hội đồng khác.'),
  ).toBeInTheDocument();
  expect(service.check).toHaveBeenLastCalledWith(
    expect.objectContaining({
      roundId: 'r1',
      chairId: 'gvb',
      secretaryId: 'gvd',
      room: 'B4.14',
      slots: [{ topicId: '002', start: '07:30', end: '08:15' }],
    }),
    null,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  expect(service.create).toHaveBeenCalledWith({
    roundId: 'r1',
    name: 'Hội đồng 2',
    chairId: 'gvb',
    secretaryId: 'gvd',
    date: '2026-10-13',
    room: 'B4.14',
    slots: [{ topicId: '002', start: '07:30', end: '08:15' }],
  });
  expect(
    await screen.findByText(/Đã lưu Hội đồng 2\. Lịch chỉ gửi đi khi bấm/),
  ).toBeInTheDocument();
});

it('hiện danh sách xung đột từ máy chủ và báo lỗi khi lưu bị từ chối', async () => {
  const problems = [
    'Phòng B4.12 trùng giờ với Hội đồng 1 (07:30–08:15).',
    'TS. Trần Minh Khoa trùng giờ với Hội đồng 1 (07:30–08:15).',
  ];
  const service = fakeService(boardOf([council()]), {
    check: vi.fn(async () => ({ ok: false, problems })),
    create: vi.fn(async () => {
      throw new CouncilConflictError('Chưa lưu được: còn 2 vấn đề cần xử lý.');
    }),
  });
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hội đồng' }));
  fireEvent.change(screen.getByLabelText('Chủ tịch'), {
    target: { value: 'gvb' },
  });
  fireEvent.change(screen.getByLabelText('Thư ký (nhập điểm hội đồng)'), {
    target: { value: 'gvd' },
  });
  fireEvent.change(screen.getByLabelText('Phòng'), {
    target: { value: 'B4.12' },
  });

  const alert = await screen.findByText('Còn 2 xung đột, chưa lưu được:');
  expect(alert.closest('[role="alert"]')).toHaveTextContent(
    'TS. Trần Minh Khoa trùng giờ',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  expect(
    await screen.findByText('Chưa lưu được: còn 2 vấn đề cần xử lý.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Tạo hội đồng' }),
  ).toBeInTheDocument();
});

it('không cho thêm đề tài khi GVHD đang ngồi hội đồng', async () => {
  const service = fakeService(boardOf([council()]));
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hội đồng' }));
  fireEvent.change(screen.getByLabelText('Chủ tịch'), {
    target: { value: 'gva' },
  });
  expect(
    screen.queryByRole('button', { name: 'Thêm DT-002 vào lịch' }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText('GVHD trong hội đồng')).toHaveLength(2);
});

it('điền giờ tự động, sửa từng lượt, báo giờ sai tại chỗ và đổi thứ tự', async () => {
  const service = fakeService(boardOf([council()]));
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm DT-002 vào lịch' }));

  fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
    target: { value: '13:00' },
  });
  fireEvent.change(screen.getByLabelText('Phút mỗi đề tài'), {
    target: { value: '5' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Điền giờ' }));
  expect(screen.getByText('Nhập số phút từ 10 đến 180.')).toHaveAttribute(
    'role',
    'alert',
  );

  fireEvent.change(screen.getByLabelText('Phút mỗi đề tài'), {
    target: { value: '30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Điền giờ' }));
  expect(screen.getByLabelText('Giờ bắt đầu DT-001')).toHaveValue('13:00');
  expect(screen.getByLabelText('Giờ kết thúc DT-002')).toHaveValue('14:00');

  fireEvent.change(screen.getByLabelText('Giờ kết thúc DT-001'), {
    target: { value: '12:00' },
  });
  expect(
    screen.getByText('Giờ kết thúc phải sau giờ bắt đầu.'),
  ).toHaveAttribute('role', 'alert');
  expect(screen.getByLabelText('Giờ kết thúc DT-001')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  fireEvent.change(screen.getByLabelText('Giờ kết thúc DT-001'), {
    target: { value: '13:30' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Đưa DT-002 lên trên' }));
  const items = screen
    .getAllByRole('listitem')
    .filter((li) => li.className.includes('cnc-slot'));
  expect(items[0]).toHaveTextContent('DT-002');
  expect(screen.getByLabelText('Giờ bắt đầu DT-002')).toHaveValue('13:00');

  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  await waitFor(() => expect(service.update).toHaveBeenCalledTimes(1));
  expect(service.update).toHaveBeenCalledWith(
    'c1',
    expect.objectContaining({
      expectedVersion: 1,
      slots: [
        { topicId: '002', start: '13:00', end: '13:30' },
        { topicId: '001', start: '13:30', end: '14:00' },
      ],
    }),
  );
});

it('sửa lịch đã công bố bắt buộc lý do và gửi kèm phiên bản', async () => {
  const published = council({
    status: 'Đã công bố',
    version: 3,
    canDelete: false,
    canCancel: true,
    canPublish: false,
  });
  const service = fakeService(boardOf([published]), {
    update: vi.fn(async () => published),
  });
  await renderPage(service);
  expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  expect(
    screen.getByText(/Đã công bố · không xóa được để lưu vết/),
  ).toHaveAttribute('role', 'note');

  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
  fireEvent.change(screen.getByLabelText('Phòng'), {
    target: { value: 'B4.14' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  expect(screen.getByText('Nhập lý do sửa lịch đã công bố.')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(service.update).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Lý do sửa lịch đã công bố'), {
    target: { value: 'Phòng sửa chữa' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hội đồng' }));
  await waitFor(() =>
    expect(service.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        room: 'B4.14',
        expectedVersion: 3,
        reason: 'Phòng sửa chữa',
      }),
    ),
  );
  expect(
    await screen.findByText(
      /gửi thông báo thay đổi lịch cho người bị ảnh hưởng/,
    ),
  ).toBeInTheDocument();
});

it('công bố lịch qua hộp xác nhận và báo hội đồng chưa công bố được', async () => {
  const service = fakeService(
    boardOf([council(), council({ id: 'c2', name: 'Hội đồng 2', slots: [] })]),
    {
      publish: vi.fn(async () => ({
        published: 1,
        skipped: 1,
        results: [
          {
            councilId: 'c1',
            name: 'Hội đồng 1',
            ok: true,
            message: 'Đã công bố.',
          },
          {
            councilId: 'c2',
            name: 'Hội đồng 2',
            ok: false,
            message: 'Hội đồng chưa có đề tài nào.',
          },
        ],
      })),
    },
  );
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Công bố lịch bảo vệ' }));
  const dialog = screen.getByRole('alertdialog', {
    name: 'Công bố lịch bảo vệ?',
  });
  expect(dialog).toHaveTextContent(
    'Công bố 2 hội đồng Nháp của đợt (Hội đồng 1, Hội đồng 2)',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Công bố lịch' }));
  await waitFor(() => expect(service.publish).toHaveBeenCalledWith('r1'));
  expect(
    await screen.findByText(
      /1 hội đồng chưa công bố được: Hội đồng 2 \(Hội đồng chưa có đề tài nào\.\)/,
    ),
  ).toBeInTheDocument();
});

it('xóa hội đồng Nháp sau khi xác nhận', async () => {
  const service = fakeService(boardOf([council()]));
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Xóa Hội đồng 1?' });
  expect(dialog).toHaveTextContent(
    '1 đề tài của hội đồng sẽ quay về danh sách chưa xếp hội đồng.',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa hội đồng' }));
  await waitFor(() => expect(service.remove).toHaveBeenCalledWith('c1'));
  expect(await screen.findByText('Đã xóa Hội đồng 1.')).toBeInTheDocument();
});

it('hủy lịch đã công bố bắt buộc lý do', async () => {
  const published = council({
    status: 'Đã công bố',
    canDelete: false,
    canCancel: true,
    canPublish: false,
  });
  const service = fakeService(boardOf([published]));
  await renderPage(service);
  fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch' }));
  const dialog = screen.getByRole('dialog', { name: 'Hủy lịch Hội đồng 1?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy lịch' }));
  expect(within(dialog).getByText('Nhập lý do.')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(service.cancel).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('Lý do'), {
    target: { value: 'Không đủ người' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy lịch' }));
  await waitFor(() =>
    expect(service.cancel).toHaveBeenCalledWith('c1', 'Không đủ người'),
  );
  expect(
    await screen.findByText(
      'Đã hủy lịch Hội đồng 1 và thông báo cho người bị ảnh hưởng.',
    ),
  ).toBeInTheDocument();
});

it('sau khi có điểm chỉ ghi đính chính, không sửa hay hủy', async () => {
  const scored = council({
    status: 'Đã công bố',
    scored: true,
    canEdit: false,
    editBlockedReason:
      'Hội đồng đã có phiếu điểm: không sửa giờ, phòng hay thành viên, không hủy lịch.',
    canDelete: false,
    canPublish: false,
    canCorrect: true,
    corrections: [
      {
        at: '2026-10-14T03:00:00Z',
        by: 'Giáo vụ',
        content: 'Phòng thực tế B4.12A',
        reason: 'Ghi nhầm',
      },
    ],
  });
  const service = fakeService(boardOf([scored]));
  await renderPage(service);
  expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Hủy lịch' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Hội đồng đã có phiếu điểm/)).toHaveAttribute(
    'role',
    'note',
  );
  expect(screen.getByText('Phòng thực tế B4.12A')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ghi đính chính' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Ghi đính chính cho Hội đồng 1',
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Ghi đính chính' }),
  );
  expect(
    within(dialog).getByText('Nhập nội dung đính chính.'),
  ).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Nội dung đính chính'), {
    target: { value: 'Bắt đầu 07:45' },
  });
  fireEvent.change(within(dialog).getByLabelText('Lý do'), {
    target: { value: 'Ghi nhầm giờ' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Ghi đính chính' }),
  );
  await waitFor(() =>
    expect(service.correct).toHaveBeenCalledWith(
      'c1',
      'Bắt đầu 07:45',
      'Ghi nhầm giờ',
    ),
  );
});

it('hiện xung đột hiện tại của hội đồng Nháp và trạng thái trống', async () => {
  const service = fakeService(
    boardOf([
      council({
        conflicts: ['DT-001: Đề tài đã kết thúc.'],
        canPublish: false,
        publishBlockedReason: 'Còn 1 xung đột',
      }),
    ]),
  );
  await renderPage(service);
  expect(
    screen
      .getByText('1 xung đột · chưa công bố được')
      .closest('[role="alert"]'),
  ).toHaveTextContent('DT-001: Đề tài đã kết thúc.');
  expect(screen.getByText('Xung đột').nextSibling).toHaveTextContent('1');
});

it('báo khi chưa có đợt đã mở', async () => {
  render(
    <CouncilBoardPage
      service={fakeService(boardOf([]))}
      roundService={{ list: vi.fn(async () => []) }}
      checkDelayMs={0}
    />,
  );
  expect(
    await screen.findByText('Chưa có đợt khóa luận nào đã mở để lập hội đồng.'),
  ).toBeInTheDocument();
});

it('hiển thị chế độ xem cho trang lẻ và có liên kết tới tab Đánh giá', async () => {
  const service = fakeService(boardOf([council()]));
  render(
    <CouncilBoardPage
      mode="view"
      service={service}
      roundService={roundService}
      checkDelayMs={0}
    />,
  );
  await screen.findByRole('table');
  expect(
    screen.queryByRole('button', { name: 'Tạo hội đồng' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Công bố lịch bảo vệ' }),
  ).not.toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Mở tab Đánh giá' });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute(
    'href',
    expect.stringContaining('/giao-vu/dot/r1?tab=danh-gia&muc=hoi-dong'),
  );
});
