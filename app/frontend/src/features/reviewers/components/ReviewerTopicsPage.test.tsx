import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MyReviewItem, MyReviews } from '@/types/reviewer';
import { ReviewerTopicsPage } from './ReviewerTopicsPage';

afterEach(cleanup);

const item = (
  id: string,
  overrides: Partial<MyReviewItem> = {},
): MyReviewItem => ({
  topicId: id,
  code: `DT-00${id}`,
  title: `Đề tài ${id}`,
  group: [
    {
      id: `sv${id}`,
      code: `2252000${id}`,
      name: `SV ${id}`,
      className: 'KTPM',
      representative: true,
    },
  ],
  supervisor: { id: 'gva', code: 'GVA', name: 'Giảng viên A' },
  assignedAt: '2026-09-12T03:00:00Z',
  hasFinal: false,
  canScore: false,
  scoreBlockedReason: 'Nhóm chưa nộp báo cáo cuối kỳ',
  scored: false,
  ...overrides,
});

const mine = (items: MyReviewItem[]): MyReviews => ({
  rounds: [{ id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra', loadMax: 0 }],
  roundId: 'r1',
  items,
});

it('lists assigned topics with the scoring state and a link to open each one', async () => {
  const service = {
    mine: vi.fn().mockResolvedValue(
      mine([
        item('1'),
        item('2', {
          canScore: true,
          scoreBlockedReason: null,
          hasFinal: true,
        }),
        item('3', { canScore: true, scoreBlockedReason: null, scored: true }),
      ]),
    ),
  };
  render(<ReviewerTopicsPage service={service} />);

  const table = await screen.findByRole('table');
  const rows = within(table).getAllByRole('row');
  expect(
    within(rows[1]).getByText('Chưa đủ điều kiện chấm'),
  ).toBeInTheDocument();
  expect(
    within(rows[1]).getByText('Nhóm chưa nộp báo cáo cuối kỳ'),
  ).toBeInTheDocument();
  expect(within(rows[2]).getByText('Chưa chấm')).toBeInTheDocument();
  expect(within(rows[3]).getByText('Đã chấm')).toBeInTheDocument();
  expect(within(rows[1]).getByText('Giảng viên A')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Mở DT-001 Đề tài 1' }),
  ).toHaveAttribute('href', '/de-tai/1');

  fireEvent.click(screen.getByRole('button', { name: 'Chưa chấm (2)' }));
  expect(screen.queryByText('DT-003')).not.toBeInTheDocument();
  expect(screen.getByText('DT-002')).toBeInTheDocument();
});

it('shows the not assigned empty state', async () => {
  const service = {
    mine: vi.fn().mockResolvedValue({ rounds: [], roundId: null, items: [] }),
  };
  render(<ReviewerTopicsPage service={service} />);

  expect(await screen.findByText('Chưa được phân công')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('shows the server error in place', async () => {
  const service = { mine: vi.fn().mockRejectedValue(new Error('Lỗi máy chủ')) };
  render(<ReviewerTopicsPage service={service} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
});
