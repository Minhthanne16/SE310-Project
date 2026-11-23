import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { resetNavigation } from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundDemoService';
import { RoundEvaluationTab } from './RoundEvaluationTab';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(cleanup);
beforeEach(() => {
  resetNavigation('/giao-vu/dot/x?tab=danh-gia');
  vi.clearAllMocks();
});

const fakeEvaluation = (roles: string[] = ['Supervisor']): EvaluationService =>
  ({
    list: vi.fn().mockResolvedValue([
      {
        id: 't-1',
        name: 'Phiếu hướng dẫn chuẩn',
        status: 'Active',
      },
    ]),
    listAssignments: vi.fn().mockResolvedValue(
      roles.map((r) => ({
        roundId: 'r-vb1-hk1',
        role: r,
        templateId: 't-1',
        templateName: 'Phiếu hướng dẫn chuẩn',
      })),
    ),
    assign: vi.fn().mockResolvedValue({
      roundId: 'r-vb1-hk1',
      role: 'Supervisor',
      templateId: 't-1',
      templateName: 'Phiếu hướng dẫn chuẩn',
    }),
    unassign: vi.fn().mockResolvedValue(undefined),
  }) as unknown as EvaluationService;

describe('RoundEvaluationTab (PDR-065, PDR-070)', () => {
  it('switches between four sections and keeps active section', async () => {
    const service = createRoundService();
    const rounds = await service.list();
    const round = rounds.find((r) => r.id === 'r-vb1-hk1')!;
    const evalService = fakeEvaluation();

    render(
      <RoundEvaluationTab
        round={round}
        roundService={service}
        evaluationService={evalService}
      />,
    );

    // Initial section is Cấu hình điểm
    expect(screen.getByRole('tab', { name: 'Cấu hình điểm' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Hệ số tính điểm khóa luận' }),
    ).toBeInTheDocument();

    // Switch to Mẫu phiếu
    fireEvent.click(screen.getByRole('tab', { name: 'Mẫu phiếu' }));
    expect(screen.getByRole('tab', { name: 'Mẫu phiếu' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('Vai trò')).toBeInTheDocument();

    // Switch to Phản biện
    fireEvent.click(screen.getByRole('tab', { name: 'Phản biện' }));
    expect(screen.getByRole('tab', { name: 'Phản biện' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Switch to Hội đồng
    fireEvent.click(screen.getByRole('tab', { name: 'Hội đồng' }));
    expect(screen.getByRole('tab', { name: 'Hội đồng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('calculates weighted score dynamically in grading config and saves in draft round', async () => {
    const service = createRoundService();
    const rounds = await service.list();
    // Use a draft round
    const draftRound = rounds.find((r) => r.status === 'Nháp')!;
    const evalService = fakeEvaluation();
    const onChanged = vi.fn();

    render(
      <RoundEvaluationTab
        round={draftRound}
        roundService={service}
        evaluationService={evalService}
        onChanged={onChanged}
      />,
    );

    // Initial grading example
    expect(screen.getByText('Ví dụ tính điểm')).toBeInTheDocument();

    // Change chair weight
    const chairInput = screen.getByLabelText('Chủ tịch hội đồng');
    fireEvent.change(chairInput, { target: { value: '2' } });

    // Save button should be enabled in draft
    const saveBtn = screen.getByRole('button', { name: 'Lưu cấu hình điểm' });
    expect(saveBtn).toBeEnabled();

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Đã lưu cấu hình điểm của đợt.',
      );
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('disables editing in running round with banner note', async () => {
    const service = createRoundService();
    const rounds = await service.list();
    const runningRound = rounds.find((r) => r.status === 'Đang diễn ra')!;
    const evalService = fakeEvaluation();

    render(
      <RoundEvaluationTab
        round={runningRound}
        roundService={service}
        evaluationService={evalService}
      />,
    );

    expect(
      screen.getByText(/Đợt đã mở, không sửa cấu hình điểm/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Chủ tịch hội đồng')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Lưu cấu hình điểm' }),
    ).not.toBeInTheDocument();
  });
});
