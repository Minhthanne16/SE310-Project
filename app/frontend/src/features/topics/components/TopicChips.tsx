import React from 'react';
import type { TopicSource, TopicStatus } from '@/types/topic';

const STATUS_CLASS: Record<TopicStatus, string> = {
  'Chưa đăng ký': '',
  'Chờ GV duyệt': 'app-chip-pending',
  'Đã đăng ký': 'app-chip-info',
  'Bị từ chối': 'app-chip-error',
  'Đang thực hiện': 'app-chip-active',
  'Đã cho điểm': 'app-chip-info',
  'Đã hoàn tất': 'app-chip-disabled',
};

export const TopicStatusChip: React.FC<{ status: TopicStatus }> = ({
  status,
}) => <span className={`app-chip ${STATUS_CLASS[status]}`}>{status}</span>;

export const TopicSourceChip: React.FC<{ source: TopicSource }> = ({
  source,
}) => <span className="app-chip">{source}</span>;
