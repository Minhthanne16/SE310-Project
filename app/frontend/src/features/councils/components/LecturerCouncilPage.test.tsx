import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CouncilSlot, MyCouncil, MyCouncils } from '@/types/council';
import { LecturerCouncilPage } from './LecturerCouncilPage';

afterEach(cleanup);

const person = (id: string, name: string) => ({
  id,
  code: id.toUpperCase(),
  name,
});

const slot = (
  id: string,
  order: number,
  overrides: Partial<CouncilSlot> = {},
): CouncilSlot => ({
  id: `s${id}`,
  order,
  topicId: id,
  code: `DT-${id}`,
  title: `Đề tài ${id}`,
  group: [
    { ...person(`sv${id}`, `SV ${id}`), className: 'K1', representative: true },
  ],
  supervisor: person('gva', 'GV A'),
  reviewer: null,
  start: order === 1 ? '07:30' : '08:15',
  end: order === 1 ? '08:15' : '09:00',
  thesisVersionCount: 0,
  finalLocked: false,
  status: 'active',
  ...overrides,
});

const council = (overrides: Partial<MyCouncil> = {}): MyCouncil => ({
  id: 'c1',
  roundId: 'r1',
  name: 'Hội đồng 1',
  status: 'Đã công bố',
  myRole: 'secretary',
  chair: person('gvb', 'GV B'),
  secretary: person('gvc', 'GV C'),
  date: '2026-10-14',
  room: 'B4.12',
  cancelReason: null,
  slots: [
    slot('001', 1, { thesisVersionCount: 3, finalLocked: true }),
    slot('002', 2, { thesisVersionCount: 2 }),
  ],
  corrections: [],
  ...overrides,
});

const data = (
  councils: MyCouncil[],
  rounds = [
    {
      id: 'r1',
      name: 'Đợt 1',
      status: 'Đang diễn ra',
      defenseStart: '',
      defenseEnd: '',
    },
  ],
): MyCouncils => ({
  rounds,
  roundId: councils.length > 0 ? 'r1' : null,
  councils,
});

it('thư ký thấy thông tin hội đồng, giờ, khóa luận và liên kết mở đề tài', async () => {
  render(
    <LecturerCouncilPage
      service={{ mine: vi.fn(async () => data([council()])) }}
    />,
  );
  const info = await screen.findByLabelText('Thông tin hội đồng');
  expect(info).toHaveTextContent('Thư ký · nhập điểm chủ tịch và thư ký');
  expect(info).toHaveTextContent('CHỦ TỊCH');
  expect(info).toHaveTextContent('GV B');
  expect(info).toHaveTextContent('14/10/2026 · 07:30–09:00 · Phòng B4.12');

  const rows = screen.getAllByRole('row').slice(1);
  expect(within(rows[0]).getByText('Chốt bản cuối')).toBeInTheDocument();
  expect(within(rows[0]).getByText('Thứ tự 1')).toBeInTheDocument();
  expect(within(rows[1]).getByText('Đã nộp')).toBeInTheDocument();
  expect(within(rows[1]).getByText('Chưa nhập điểm')).toBeInTheDocument();
  expect(
    within(rows[0]).getByRole('link', { name: 'Mở DT-001 Đề tài 001' }),
  ).toHaveAttribute('href', '/de-tai/001');
  expect(
    screen.getByRole('button', { name: 'Chưa nhập điểm (2)' }),
  ).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Chưa nhập điểm (2)' }));
  expect(
    screen.getByRole('button', { name: 'Chưa nhập điểm (2)' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('chủ tịch chỉ xem điểm và thấy đính chính', async () => {
  const chair = council({
    myRole: 'chair',
    corrections: [
      {
        at: '2026-10-14T03:00:00Z',
        by: 'Giáo vụ',
        content: 'Phòng B4.12A',
        reason: 'Ghi nhầm',
      },
    ],
  });
  render(
    <LecturerCouncilPage
      service={{ mine: vi.fn(async () => data([chair])) }}
    />,
  );
  expect(
    await screen.findByText('Chủ tịch · chỉ xem điểm'),
  ).toBeInTheDocument();
  expect(screen.getByText('THƯ KÝ')).toBeInTheDocument();
  expect(screen.getAllByText('Thư ký chưa nhập')).toHaveLength(2);
  expect(
    screen.getByText(/Đính chính .*Phòng B4\.12A\. Lý do: Ghi nhầm/),
  ).toHaveAttribute('role', 'note');
  expect(
    screen.getByText(/Bạn xem tài liệu và điểm, không nhập điểm/),
  ).toBeInTheDocument();
});

it('lịch đã hủy hiện lý do, không có nút mở', async () => {
  render(
    <LecturerCouncilPage
      service={{
        mine: vi.fn(async () =>
          data([council({ status: 'Đã hủy', cancelReason: 'Không đủ người' })]),
        ),
      }}
    />,
  );
  expect(
    await screen.findByText('Lịch đã hủy. Lý do: Không đủ người.'),
  ).toHaveAttribute('role', 'note');
  expect(
    screen.queryByRole('link', { name: /Mở DT-001/ }),
  ).not.toBeInTheDocument();
});

it('chưa thuộc hội đồng nào hiện trạng thái trống; nhiều đợt thì cho đổi đợt', async () => {
  const mine = vi.fn(async (roundId?: string) =>
    roundId === 'r2'
      ? {
          ...data([]),
          rounds: [
            {
              id: 'r1',
              name: 'Đợt 1',
              status: 'Đang diễn ra',
              defenseStart: '',
              defenseEnd: '',
            },
            {
              id: 'r2',
              name: 'Đợt 2',
              status: 'Đã kết thúc',
              defenseStart: '',
              defenseEnd: '',
            },
          ],
          roundId: 'r2',
        }
      : data(
          [council()],
          [
            {
              id: 'r1',
              name: 'Đợt 1',
              status: 'Đang diễn ra',
              defenseStart: '',
              defenseEnd: '',
            },
            {
              id: 'r2',
              name: 'Đợt 2',
              status: 'Đã kết thúc',
              defenseStart: '',
              defenseEnd: '',
            },
          ],
        ),
  );
  render(<LecturerCouncilPage service={{ mine }} />);
  fireEvent.change(await screen.findByLabelText('Lọc theo đợt'), {
    target: { value: 'r2' },
  });
  expect(
    await screen.findByText('Bạn chưa thuộc hội đồng bảo vệ nào'),
  ).toBeInTheDocument();
  expect(mine).toHaveBeenLastCalledWith('r2');
});

it('báo lỗi khi không tải được', async () => {
  render(
    <LecturerCouncilPage
      service={{
        mine: vi.fn(async () => Promise.reject(new Error('Mất kết nối'))),
      }}
    />,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
});
