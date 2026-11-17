'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import { CancelRegistrationDialog } from '@/features/workspace/components/CancelRegistrationDialog';
import type { OutlineViewerRole } from '@/types/outline';
import type { TopicDetailDto } from '@/types/topic';

interface WorkspaceHeaderProps {
  topic: TopicDetailDto;
  viewerRole: OutlineViewerRole;
  canCancel?: boolean;
  embedded?: boolean;
  onConfirmCancel?: (topicId: string) => Promise<void>;
}

const BACK_LINKS: Record<
  OutlineViewerRole,
  { href: (id: string) => string; label: string }
> = {
  member: { href: () => '/sv/de-tai', label: 'Đề tài của tôi' },
  supervisor: { href: () => '/gv/huong-dan', label: 'Nhóm hướng dẫn' },
  reviewer: { href: () => '/gv/phan-bien', label: 'Đề tài phản biện' },
  council: { href: () => '/gv/hoi-dong', label: 'Hội đồng bảo vệ' },
  staff: {
    href: (id) => `/giao-vu/de-tai/${encodeURIComponent(id)}`,
    label: 'Chi tiết đề tài',
  },
};

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  topic,
  viewerRole,
  canCancel = false,
  embedded = false,
  onConfirmCancel,
}) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const back = BACK_LINKS[viewerRole];

  return (
    <header className="wsp-header">
      {!embedded && back && (
        <Link href={back.href(topic.id)} className="wsp-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{back.label}</span>
        </Link>
      )}

      <div className="wsp-title-row">
        <div className="wsp-title-group">
          <h1 className="wsp-title">{topic.title}</h1>
          <div className="wsp-meta-chips">
            <TopicStatusChip status={topic.status} />
            <span className="wsp-code-chip">{topic.code}</span>
            {topic.round?.name && (
              <span className="wsp-round-chip">Đợt {topic.round.name}</span>
            )}
          </div>
        </div>

        <div className="wsp-header-actions">
          {viewerRole === 'member' && canCancel && onConfirmCancel && (
            <>
              <button
                type="button"
                className="app-button app-button-danger"
                onClick={() => setShowCancelDialog(true)}
              >
                Hủy ghi danh
              </button>
              <span className="wsp-header-note">
                Hủy được trong thời gian đăng ký, khi nhóm chưa nộp bài nào.
              </span>
            </>
          )}
        </div>
      </div>

      {showCancelDialog && onConfirmCancel && (
        <CancelRegistrationDialog
          topic={topic}
          onCancel={() => setShowCancelDialog(false)}
          onConfirmCancel={onConfirmCancel}
        />
      )}
    </header>
  );
};
