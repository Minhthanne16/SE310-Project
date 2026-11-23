import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { createRoundService } from '@/features/rounds/services/roundDemoService';
import { RoundParticipantsTab } from './RoundParticipantsTab';
import type { Round } from '@/types/round';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoundParticipantsTab - Lecturer Roles (PDR-070)', () => {
  it('renders lecturer roles checkboxes and updates role on toggle', async () => {
    const service = createRoundService();
    const rounds = await service.list();
    const round = rounds.find((r) => r.id === 'r-vb1-hk1')!;
    const onChanged = vi.fn();

    render(
      <RoundParticipantsTab
        kind="lecturer"
        round={round}
        roundService={service}
        onChanged={onChanged}
      />,
    );

    // Wait for participants table to load
    await screen.findByRole('table');
    expect(screen.getByText('Vai trò trong đợt')).toBeInTheDocument();

    // Check that checkboxes exist
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    // Filter by role: Click "Hội đồng"
    const committeeFilter = screen.getByRole('button', { name: 'Hội đồng' });
    fireEvent.click(committeeFilter);
    expect(committeeFilter).toHaveClass('rnd-btn-primary');

    // Filter by role: Click "Tất cả"
    const allFilter = screen.getByRole('button', { name: 'Tất cả' });
    fireEvent.click(allFilter);
    expect(allFilter).toHaveClass('rnd-btn-primary');

    // Click "Nhập vai trò từ Excel" button
    const importBtn = screen.getByRole('button', {
      name: 'Nhập vai trò từ Excel',
    });
    fireEvent.click(importBtn);

    // Dialog should appear
    expect(
      screen.getByRole('heading', { name: 'Nhập vai trò giảng viên từ Excel' }),
    ).toBeInTheDocument();

    // Close dialog by clicking "Hủy"
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByRole('heading', {
        name: 'Nhập vai trò giảng viên từ Excel',
      }),
    ).not.toBeInTheDocument();

    // Toggle Reviewer role for first lecturer
    const reviewerCheckbox = checkboxes[1]; // first row: 0=supervisor, 1=reviewer, 2=committee
    expect(reviewerCheckbox).toBeChecked();
    fireEvent.click(reviewerCheckbox);

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('prevents unchecking all three roles', async () => {
    const service = createRoundService();
    const rounds = await service.list();
    // Create a round with a lecturer having only 1 role
    const baseRound = rounds.find((r) => r.id === 'r-vb1-hk1')!;
    const lecturerId = baseRound.lecturerIds[0];
    const round: Round = {
      ...baseRound,
      lecturerRoles: [
        {
          userId: lecturerId,
          code: 'GV001',
          name: 'Nguyen Van A',
          email: 'nva@fit.edu.vn',
          unit: 'CNTT',
          isSupervisor: true,
          isReviewer: false,
          isCommittee: false,
        },
      ],
    };
    const onChanged = vi.fn();

    render(
      <RoundParticipantsTab
        kind="lecturer"
        round={round}
        roundService={service}
        onChanged={onChanged}
      />,
    );

    await screen.findByRole('table');

    // Find the supervisor checkbox for this lecturer and uncheck it
    const checkboxes = screen.getAllByRole('checkbox');
    const supervisorCheckbox = checkboxes[0]; // first checkbox of the first row
    expect(supervisorCheckbox).toBeChecked();

    fireEvent.click(supervisorCheckbox);

    // Toast error should be called
    expect(toast.error).toHaveBeenCalledWith(
      'Mỗi giảng viên phải có ít nhất 1 vai trò trong đợt.',
    );
    expect(onChanged).not.toHaveBeenCalled();
  });
});
