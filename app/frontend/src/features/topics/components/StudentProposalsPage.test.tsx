import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudentProposalService } from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type {
  StudentProposals,
  TopicDetailDto,
  TopicPerson,
} from '@/types/topic';
import { StudentProposalsPage } from './StudentProposalsPage';

vi.mock('@/features/auth/session/SessionProvider', () => ({
  useSession: () => ({
    session: { status: 'authenticated', user: { id: 'sv2' } },
  }),
}));

afterEach(cleanup);

const round = (): Round =>
  ({
    id: 'r1',
    name: 'Văn bằng 1 · HK1',
    status: 'Đang diễn ra',
    topicsPublishedAt: '2026-11-11T02:00:00Z',
  }) as Round;

const proposal = (overrides: Partial<TopicDetailDto> = {}): TopicDetailDto =>
  ({
    id: 'p1',
    roundId: 'r1',
    code: 'DX-001',
    title: 'Đề tài đang chờ',
    field: 'Kỹ thuật phần mềm',
    description: 'Mô tả đề xuất',
    requirements: null,
    supervisor: { id: 'gv1', code: 'GV0001', name: 'Người GV' },
    source: 'SV đề xuất',
    status: 'Chờ GV duyệt',
    createdAt: '2026-11-12T08:00:00Z',
    updatedAt: null,
    canEdit: 'none',
    canDelete: false,
    group: [
      {
        id: 'sv1',
        code: '22520001',
        name: 'Người SV',
        className: 'KTPM2022',
        representative: true,
      },
      {
        id: 'sv2',
        code: '22520002',
        name: 'Bạn cùng nhóm',
        className: 'KTPM2022',
        representative: false,
      },
    ],
    history: [
      {
        id: 'h1',
        at: '2026-11-12T08:00:00Z',
        actor: 'Người SV',
        category: 'Trạng thái',
        action: 'Gửi đề xuất',
        detail: null,
      },
    ],
    ...overrides,
  }) as TopicDetailDto;

const data = (items: TopicDetailDto[]): StudentProposals =>
  ({
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
    registrationOpen: true,
    group: {
      id: 'g1',
      representativeId: 'sv1',
      members: proposal().group,
    },
    items,
  }) as StudentProposals;

const fakeService = (
  values: StudentProposals,
  overrides: Partial<StudentProposalService> = {},
): StudentProposalService => ({
  listRounds: vi.fn().mockResolvedValue([round()]),
  listMine: vi.fn().mockResolvedValue(values),
  listSupervisors: vi
    .fn()
    .mockResolvedValue([
      { id: 'gv1', code: 'GV0001', name: 'Người GV' },
    ] satisfies TopicPerson[]),
  create: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn().mockResolvedValue(proposal({ status: 'Đã hủy' })),
  ...overrides,
});

it('separates a cancelled proposal into history and keeps its actor and reason visible', async () => {
  const cancelled = proposal({
    id: 'p-cancelled',
    title: 'Đề tài đã hủy',
    status: 'Đã hủy',
    history: [
      {
        id: 'h-cancelled',
        at: '2026-11-12T09:00:00Z',
        actor: 'Bạn cùng nhóm',
        category: 'Trạng thái',
        action: 'Hủy đề xuất',
        detail: 'Hủy cho cả nhóm; nhóm giữ nguyên thành viên và đại diện.',
      },
    ],
  });

  render(
    <StudentProposalsPage
      service={fakeService(data([proposal(), cancelled]))}
    />,
  );

  const active = await screen.findByRole('table', {
    name: 'Đề xuất đang hoạt động',
  });
  expect(active).toHaveTextContent('Đề tài đang chờ');
  expect(active).not.toHaveTextContent('Đề tài đã hủy');
  expect(
    screen.getByRole('heading', { name: 'Lịch sử đề xuất đã hủy' }),
  ).toBeInTheDocument();
  fireEvent.click(
    within(
      screen.getByRole('table', { name: 'Lịch sử đề xuất đã hủy' }),
    ).getByText('Lịch sử xử lý (1)', { exact: false }),
  );
  expect(screen.getByText('Bạn cùng nhóm')).toBeInTheDocument();
  expect(screen.getByText('Hủy đề xuất')).toBeInTheDocument();
});

it('lets any group member cancel a pending proposal and refreshes the tracking data', async () => {
  const service = fakeService(data([proposal()]));
  render(<StudentProposalsPage service={service} />);

  await screen.findByText('Đề tài đang chờ');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Hủy đề xuất?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy đề xuất' }));

  expect(
    await screen.findByText('Đã hủy đề xuất cho cả nhóm.'),
  ).toBeInTheDocument();
  expect(service.cancel).toHaveBeenCalledWith('p1');
  expect(service.listMine).toHaveBeenCalledTimes(2);
});
