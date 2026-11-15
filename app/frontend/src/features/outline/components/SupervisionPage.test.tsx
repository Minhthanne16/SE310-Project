import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Round } from '@/types/round';
import type { LecturerTopicList, TopicDto } from '@/types/topic';
import { SupervisionPage } from './SupervisionPage';

afterEach(cleanup);

const round = {
  id: 'r1',
  name: 'Văn bằng 1 · HK1',
  status: 'Đang diễn ra',
} as Round;

const topic = (id: string, overrides: Partial<TopicDto> = {}): TopicDto => ({
  id,
  roundId: 'r1',
  code: `DT-00${id}`,
  title: `Đề tài ${id}`,
  field: 'CNPM',
  description: 'Mô tả',
  requirements: null,
  supervisor: { id: 'gv1', code: 'GV0001', name: 'Trần Thị Bình' },
  source: 'GV công bố',
  status: 'Đã đăng ký',
  createdAt: '2026-09-01T03:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  group: [
    {
      id: `sv${id}`,
      code: `2252000${id}`,
      name: `SV ${id}`,
      className: 'KTPM',
      representative: true,
    },
  ],
  outlineApprovedAt: null,
  outline: { versions: 0, openRequests: 0, awaitingReview: false },
  ...overrides,
});

const list = (items: TopicDto[]): LecturerTopicList =>
  ({
    round: { roundId: 'r1' },
    items,
    load: {},
  }) as unknown as LecturerTopicList;

it('lists supervised groups with the outline stage and filters those needing action', async () => {
  const service = {
    listRounds: vi.fn().mockResolvedValue([round]),
    listMine: vi.fn().mockResolvedValue(
      list([
        topic('1'),
        topic('2', {
          outline: { versions: 2, openRequests: 1, awaitingReview: true },
        }),
        topic('3', {
          outline: { versions: 1, openRequests: 2, awaitingReview: false },
        }),
        topic('4', {
          outline: { versions: 3, openRequests: 0, awaitingReview: false },
          outlineApprovedAt: '2026-09-18T03:00:00Z',
        }),
        topic('5', { group: [], outline: null, status: 'Chưa đăng ký' }),
      ]),
    ),
  };
  render(<SupervisionPage service={service} />);

  const table = await screen.findByRole('table');
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(4);
  expect(within(rows[0]).getByText('Chưa nộp')).toBeInTheDocument();
  expect(
    within(rows[1]).getByText('Chờ GVHD xem · 2 phiên bản'),
  ).toBeInTheDocument();
  expect(
    within(rows[1]).getByText('Kiểm tra bản nộp lại, đóng 1 yêu cầu rồi duyệt'),
  ).toBeInTheDocument();
  expect(
    within(rows[2]).getByText('Chờ nhóm sửa · 2 yêu cầu mở'),
  ).toBeInTheDocument();
  expect(within(rows[3]).getByText(/^Đã duyệt/)).toBeInTheDocument();
  expect(
    within(rows[1]).getByRole('link', { name: 'Mở DT-002 Đề tài 2' }),
  ).toHaveAttribute('href', '/de-tai/2');

  fireEvent.click(screen.getByRole('button', { name: 'Cần xử lý (1)' }));
  expect(screen.getByRole('button', { name: 'Cần xử lý (1)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
});

it('shows the empty state when no group has taken a topic', async () => {
  const service = {
    listRounds: vi.fn().mockResolvedValue([round]),
    listMine: vi
      .fn()
      .mockResolvedValue(list([topic('5', { group: [], outline: null })])),
  };
  render(<SupervisionPage service={service} />);
  expect(await screen.findByText('Chưa có nhóm')).toBeInTheDocument();
});
