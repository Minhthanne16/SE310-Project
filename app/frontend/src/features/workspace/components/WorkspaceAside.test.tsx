import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { TopicDefense, TopicDetailDto } from '@/types/topic';
import { WorkspaceAside } from './WorkspaceAside';

afterEach(cleanup);

const topic = (defense: TopicDefense | null) =>
  ({
    id: 't1',
    code: 'DT-001',
    title: 'Đề tài',
    supervisor: { id: 'gv1', code: 'GV1', name: 'GV A', email: null },
    group: [],
    defense,
  }) as unknown as TopicDetailDto;

const defense: TopicDefense = {
  councilId: 'c1',
  council: 'Hội đồng 1',
  councilPublished: true,
  chair: 'GV B',
  secretary: 'GV C',
  date: '2026-10-14',
  start: '2026-10-14T07:30:00',
  end: '2026-10-14T08:15:00',
  room: 'B4.12',
  order: 2,
  corrections: [
    {
      at: '2026-10-14T03:00:00Z',
      by: 'Giáo vụ',
      content: 'Phòng B4.12A',
      reason: 'Ghi nhầm',
    },
  ],
};

it('hiện hội đồng, ngày giờ bắt đầu–kết thúc, phòng, thứ tự và đính chính (P06)', () => {
  render(
    <WorkspaceAside
      topic={topic(defense)}
      viewerRole="member"
      activeTab="hoat-dong"
    />,
  );
  expect(screen.getByText('Hội đồng 1')).toBeInTheDocument();
  expect(screen.getByText(/14\/10\/2026 · 07:30–08:15/)).toBeInTheDocument();
  expect(screen.getByText('Chủ tịch: GV B · Thư ký: GV C')).toBeInTheDocument();
  expect(screen.getByText('Phòng: B4.12 · Thứ tự: 2')).toBeInTheDocument();
  expect(
    screen.getByText('Đính chính: Phòng B4.12A (Ghi nhầm)'),
  ).toHaveAttribute('role', 'note');
});

it('Giáo vụ thấy lịch Nháp được đánh dấu chưa công bố', () => {
  render(
    <WorkspaceAside
      topic={topic({ ...defense, councilPublished: false, corrections: [] })}
      viewerRole="staff"
      activeTab="hoat-dong"
    />,
  );
  expect(
    screen.getByText('Hội đồng 1 · Nháp (chưa công bố)'),
  ).toBeInTheDocument();
});

it('chưa xếp lịch thì báo chưa phân công', () => {
  render(
    <WorkspaceAside
      topic={topic(null)}
      viewerRole="member"
      activeTab="hoat-dong"
    />,
  );
  expect(screen.getAllByText('Chưa phân công')).toHaveLength(2);
});
