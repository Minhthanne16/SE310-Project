import React from 'react';
import type { MilestoneStatus, RoundProgram, RoundStatus } from '@/types/round';

const ROUND_STATUS_CLASS: Record<RoundStatus, string> = {
  Nháp: 'app-chip-pending',
  'Đang diễn ra': 'app-chip-active',
  'Đã kết thúc': 'app-chip-disabled',
};

const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  'Đã qua': 'app-chip-disabled',
  'Đang diễn ra': 'app-chip-info',
  'Sắp tới': '',
};

export const ProgramChip: React.FC<{ program: RoundProgram }> = ({
  program,
}) => <span className="app-chip">{program}</span>;

export const RoundStatusChip: React.FC<{ status: RoundStatus }> = ({
  status,
}) => (
  <span className={`app-chip ${ROUND_STATUS_CLASS[status]}`}>{status}</span>
);

export const MilestoneStatusChip: React.FC<{ status: MilestoneStatus }> = ({
  status,
}) => (
  <span className={`app-chip ${MILESTONE_STATUS_CLASS[status]}`}>{status}</span>
);
