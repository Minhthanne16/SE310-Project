import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudentTopicService } from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type { RoundTopicList, TopicDto } from '@/types/topic';
import { StudentTopicsPage } from './StudentTopicsPage';

afterEach(cleanup);

const round = (overrides: Partial<Round> = {}): Round =>
  ({
    id: 'r1',
    name: 'Văn bằng 1 · HK1',
    status: 'Đang diễn ra',
    topicsPublishedAt: '2026-11-11T02:00:00Z',
    ...overrides,
  }) as Round;

const topic = (overrides: Partial<TopicDto> = {}): TopicDto => ({
  id: 't1',
  roundId: 'r1',
  code: 'DT-001',
  title: 'Hệ thống gợi ý khóa học',
  field: 'Trí tuệ nhân tạo',
  description: 'Gợi ý theo lịch sử học tập',
  requirements: null,
  supervisor: { id: 'gv1', code: 'GV0001', name: 'Trần Thị Bình' },
  source: 'GV công bố',
  status: 'Chưa đăng ký',
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  group: [],
  ...overrides,
});

const published: RoundTopicList = {
  round: {
    roundId: 'r1',
    roundName: 'Văn bằng 1 · HK1',
    roundStatus: 'Đang diễn ra',
    topicsPublishedAt: '2026-11-11T02:00:00Z',
    submissionStart: '2026-11-01',
    submissionEnd: '2026-11-10',
    registrationEnd: '2026-11-20',
    canSubmit: false,
    submitBlockedReason: null,
  },
  items: [
    topic(),
    topic({
      id: 't2',
      code: 'DT-002',
      title: 'Phân tích log',
      field: 'Khoa học dữ liệu',
      status: 'Đã đăng ký',
    }),
  ],
  loads: [],
};

const fakeService = (
  overrides: Partial<StudentTopicService> = {},
): StudentTopicService => ({
  listRounds: vi.fn().mockResolvedValue([round()]),
  listPublished: vi.fn().mockResolvedValue(published),
  ...overrides,
});

it('shows the published topics with registration deadline, search and details', async () => {
  render(<StudentTopicsPage service={fakeService()} />);

  expect(
    await screen.findByText('Hệ thống gợi ý khóa học'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/đăng ký đến 23:59 ngày 20\/11\/2026/),
  ).toBeInTheDocument();
  expect(screen.getByText('Đã đăng ký')).toBeInTheDocument();
  expect(screen.getAllByText('Không có yêu cầu riêng.')).toHaveLength(2);

  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'khoa học' },
  });
  expect(screen.queryByText('Hệ thống gợi ý khóa học')).not.toBeInTheDocument();
  expect(screen.getByText('Phân tích log')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'không có' },
  });
  expect(
    screen.getByRole('heading', { name: 'Không có đề tài phù hợp' }),
  ).toBeInTheDocument();
});

it('does not ask for the list before staff publishes it', async () => {
  const service = fakeService({
    listRounds: vi.fn().mockResolvedValue([round({ topicsPublishedAt: null })]),
  });
  render(<StudentTopicsPage service={service} />);

  expect(
    await screen.findByRole('heading', { name: 'Chưa có danh sách đề tài' }),
  ).toBeInTheDocument();
  expect(service.listPublished).not.toHaveBeenCalled();
});

it('explains when the student has no running round', async () => {
  render(
    <StudentTopicsPage
      service={fakeService({
        listRounds: vi
          .fn()
          .mockResolvedValue([round({ status: 'Đã kết thúc' })]),
      })}
    />,
  );
  expect(
    await screen.findByRole('heading', { name: 'Chưa có đợt đăng ký' }),
  ).toBeInTheDocument();
});

it('shows a load error', async () => {
  render(
    <StudentTopicsPage
      service={fakeService({
        listPublished: vi.fn().mockRejectedValue(new Error('Máy chủ bận.')),
      })}
    />,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ bận.');
});
