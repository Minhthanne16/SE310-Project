import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { LecturerProposalService } from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type { LecturerProposals, TopicDetailDto } from '@/types/topic';
import { LecturerProposalsPage } from './LecturerProposalsPage';

afterEach(cleanup);

const round = (): Round =>
  ({
    id: 'r1',
    name: 'Văn bằng 1 · HK1',
    status: 'Đang diễn ra',
    topicsPublishedAt: '2026-11-11T02:00:00Z',
  }) as Round;

const proposal = (): TopicDetailDto =>
  ({
    id: 'p1',
    roundId: 'r1',
    code: 'DX-001',
    title: 'Đề tài cần duyệt',
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
    ],
    history: [],
  }) as TopicDetailDto;

const list = (): LecturerProposals =>
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
    items: [proposal()],
    load: { lecturerId: 'gv1', count: 0, min: 0, max: 3, level: 'ok' },
  }) as LecturerProposals;

const fakeService = (
  overrides: Partial<LecturerProposalService> = {},
): LecturerProposalService => ({
  listRounds: vi.fn().mockResolvedValue([round()]),
  list: vi.fn().mockResolvedValue(list()),
  accept: vi.fn().mockResolvedValue(proposal()),
  reject: vi.fn().mockResolvedValue(proposal()),
  ...overrides,
});

it('accepts a pending proposal through an explicit confirmation and refreshes the queue', async () => {
  const service = fakeService();
  render(<LecturerProposalsPage service={service} />);

  await screen.findByText('Đề tài cần duyệt');
  fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận' }));
  const dialog = screen.getByRole('alertdialog', {
    name: 'Chấp nhận đề xuất?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Chấp nhận' }));

  expect(await screen.findByText('Đã chấp nhận đề xuất.')).toBeInTheDocument();
  expect(service.accept).toHaveBeenCalledWith('p1');
  expect(service.list).toHaveBeenCalledTimes(2);
});

it('requires a reason before the lecturer can reject a proposal', async () => {
  const service = fakeService();
  render(<LecturerProposalsPage service={service} />);

  await screen.findByText('Đề tài cần duyệt');
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Từ chối đề xuất?' });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Từ chối đề xuất' }),
  );
  expect(within(dialog).getByText('Nhập lý do từ chối.')).toBeInTheDocument();
  expect(service.reject).not.toHaveBeenCalled();

  fireEvent.change(within(dialog).getByLabelText(/Lý do từ chối/), {
    target: { value: 'Trùng với đề tài đã có.' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Từ chối đề xuất' }),
  );
  expect(await screen.findByText('Đã từ chối đề xuất.')).toBeInTheDocument();
  expect(service.reject).toHaveBeenCalledWith('p1', 'Trùng với đề tài đã có.');
});
