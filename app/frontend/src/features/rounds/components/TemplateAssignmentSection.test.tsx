import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { createRoundService } from '@/features/rounds/services/roundDemoService';
import { TemplateAssignmentSection } from './TemplateAssignmentSection';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import type { EvaluationTemplate } from '@/types/evaluation';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const template = (
  over: Partial<EvaluationTemplate> = {},
): EvaluationTemplate => ({
  id: 't-1',
  name: 'Phiếu hướng dẫn chuẩn',
  description: 'Giảng viên hướng dẫn chấm sau khi chốt bản cuối.',
  maxScore: 10,
  status: 'Active',
  criteria: [
    {
      id: 'c-1',
      name: 'Nội dung và giải pháp',
      description: null,
      maxScore: 6,
      subCriteria: [
        { id: 's-1', name: 'Phân tích yêu cầu', maxScore: 3 },
        { id: 's-2', name: 'Thiết kế hệ thống', maxScore: 3 },
      ],
    },
    {
      id: 'c-2',
      name: 'Trình bày',
      description: null,
      maxScore: 4,
      subCriteria: [{ id: 's-3', name: 'Báo cáo', maxScore: 4 }],
    },
  ],
  assignments: [],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: null,
  ...over,
});

const fakeService = (
  created?: Partial<EvaluationTemplate>,
): EvaluationService =>
  ({
    list: vi.fn().mockResolvedValue([template()]),
    listAssignments: vi.fn().mockResolvedValue([
      {
        roundId: 'r-ths-1',
        role: 'Supervisor',
        templateId: 't-1',
        templateName: 'Phiếu hướng dẫn chuẩn',
      },
    ]),
    create: vi
      .fn()
      .mockImplementation(async (input) =>
        template({ id: 't-new', name: input.name, ...created }),
      ),
    assign: vi.fn(),
    unassign: vi.fn(),
  }) as unknown as EvaluationService;

const loadRound = async (status: 'Nháp' | 'Đang diễn ra') => {
  const rounds = await createRoundService().list();
  const round = rounds.find((r) => r.status === status)!;
  return { ...round, id: 'r-ths-1' };
};

const openSupervisor = async () => {
  const buttons = await screen.findAllByRole('button', { name: 'Đổi mẫu' });
  fireEvent.click(buttons[0]);
  return screen.findByRole('dialog');
};

describe('TemplateAssignmentSection: chi tiết mẫu và tạo mẫu trong panel', () => {
  it('shows criteria of the assigned template in the side panel', async () => {
    const round = await loadRound('Nháp');
    render(
      <TemplateAssignmentSection
        round={round}
        evaluationService={fakeService()}
      />,
    );
    const dialog = await openSupervisor();
    expect(within(dialog).getByText('Chi tiết mẫu')).toBeInTheDocument();
    expect(within(dialog).getByText('Tổng 10 / 10')).toBeInTheDocument();
    expect(within(dialog).getByText('Nội dung và giải pháp')).toBeVisible();
    expect(within(dialog).getByText('Phân tích yêu cầu')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: '+ Tạo mẫu phiếu mới' }),
    ).toBeEnabled();
  });

  it('keeps template creation available but locks assignment when the round is open', async () => {
    const round = await loadRound('Đang diễn ra');
    render(
      <TemplateAssignmentSection
        round={round}
        evaluationService={fakeService()}
      />,
    );
    const dialog = await openSupervisor();
    expect(within(dialog).getByLabelText(/Chọn mẫu phiếu/)).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: '+ Tạo mẫu phiếu mới' }),
    ).toBeEnabled();
  });

  it('creates a template inside the panel and selects it for the role', async () => {
    const round = await loadRound('Nháp');
    const service = fakeService();
    render(
      <TemplateAssignmentSection round={round} evaluationService={service} />,
    );
    const dialog = await openSupervisor();
    fireEvent.click(
      within(dialog).getByRole('button', { name: '+ Tạo mẫu phiếu mới' }),
    );

    const name = await within(dialog).findByLabelText('Tên mẫu phiếu');
    fireEvent.change(name, { target: { value: 'Phiếu HD rút gọn' } });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lưu mẫu phiếu' }),
    );

    await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
    expect(
      (service.create as ReturnType<typeof vi.fn>).mock.calls[0][0].name,
    ).toBe('Phiếu HD rút gọn');
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Phiếu HD rút gọn'),
      ),
    );
    // Quay lại chi tiết, mẫu mới có trong danh sách và đang được chọn.
    const select = within(dialog).getByLabelText(
      /Chọn mẫu phiếu/,
    ) as HTMLSelectElement;
    expect(select.value).toBe('t-new');
  });

  it('goes back to the detail view when creation is cancelled', async () => {
    const round = await loadRound('Nháp');
    render(
      <TemplateAssignmentSection
        round={round}
        evaluationService={fakeService()}
      />,
    );
    const dialog = await openSupervisor();
    fireEvent.click(
      within(dialog).getByRole('button', { name: '+ Tạo mẫu phiếu mới' }),
    );
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Hủy tạo mẫu' }),
    );
    expect(await within(dialog).findByText('Chi tiết mẫu')).toBeInTheDocument();
  });
});
