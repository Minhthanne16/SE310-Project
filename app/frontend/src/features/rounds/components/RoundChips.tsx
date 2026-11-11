import '@/features/rounds/rounds.css';
import React from 'react';
import type { RoundStatus } from '@/types/round';

const ROUND_STATUS_CLASS: Record<RoundStatus, string> = {
  Nháp: 'app-chip-pending',
  'Đang diễn ra': 'app-chip-active',
  'Đã kết thúc': 'app-chip-disabled',
};

export const RoundStatusChip: React.FC<{ status: RoundStatus }> = ({
  status,
}) => (
  <span className={`app-chip ${ROUND_STATUS_CLASS[status]}`}>{status}</span>
);

const ROUND_PILL_CLASS: Record<RoundStatus, string> = {
  Nháp: 'rnd-pill-draft',
  'Đang diễn ra': 'rnd-pill-live',
  'Đã kết thúc': 'rnd-pill-done',
};

// Chip trạng thái của màn Đợt khóa luận (Giáo vụ): Đang diễn ra nền đen.
export const RoundStatusPill: React.FC<{ status: RoundStatus }> = ({
  status,
}) => <span className={`rnd-pill ${ROUND_PILL_CLASS[status]}`}>{status}</span>;
