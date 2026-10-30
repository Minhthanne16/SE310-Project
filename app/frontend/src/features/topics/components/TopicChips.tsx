import React from 'react';
import '@/features/topics/topics.css';
import type { TopicSource, TopicStatus } from '@/types/topic';

const STATUS_CLASS: Record<TopicStatus, string> = {
  'Chưa đăng ký': '',
  'Chờ GV duyệt': 'tpc-chip-pending',
  'Bị từ chối': 'tpc-chip-rejected',
  'Đã đăng ký': 'tpc-chip-registered',
  'Đang thực hiện': 'tpc-chip-active',
  'Đã cho điểm': 'tpc-chip-graded',
  'Đã hoàn tất': 'tpc-chip-done',
};

export const TopicStatusChip: React.FC<{ status: TopicStatus }> = ({
  status,
}) => <span className={`tpc-chip ${STATUS_CLASS[status]}`}>{status}</span>;

export const TopicSourceChip: React.FC<{ source: TopicSource }> = ({
  source,
}) => <span className="tpc-chip">{source}</span>;
