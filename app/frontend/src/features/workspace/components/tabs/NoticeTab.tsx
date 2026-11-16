'use client';

import React from 'react';
import type { OutlineViewerRole } from '@/types/outline';

export interface NoticeCardProps {
  id?: string;
  avatarText?: string;
  senderName: string;
  senderRole: string;
  scopeText: string;
  timeText: string;
  title: string;
  content: string;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  avatarText,
  senderName,
  senderRole,
  scopeText,
  timeText,
  title,
  content,
}) => {
  const avatarInitials =
    avatarText || (senderName ? senderName.charAt(0).toUpperCase() : '?');

  return (
    <article className="app-card wsp-notice-card" aria-label={title}>
      <div className="wsp-notice-card-header">
        <div className="wsp-notice-avatar" aria-hidden="true">
          {avatarInitials}
        </div>
        <div className="wsp-notice-sender-group">
          <div className="wsp-notice-sender-row">
            <span className="wsp-notice-sender-name">{senderName}</span>
            <span className="app-chip app-chip-info">{senderRole}</span>
            <span className="wsp-notice-meta">gửi {scopeText}</span>
          </div>
          <div className="wsp-notice-meta">{timeText}</div>
        </div>
      </div>
      <h3 className="wsp-notice-card-title">{title}</h3>
      <p className="wsp-notice-content">{content}</p>
    </article>
  );
};

interface NoticeTabProps {
  viewerRole: OutlineViewerRole;
  notices?: NoticeCardProps[];
}

export const NoticeTab: React.FC<NoticeTabProps> = ({
  viewerRole,
  notices = [],
}) => {
  const leadText =
    viewerRole === 'member'
      ? 'Thông báo gửi đến nhóm bạn, từ giảng viên hướng dẫn và giáo vụ. Mới nhất ở trên.'
      : 'Thông báo đã gửi đến nhóm này, từ giảng viên hướng dẫn và giáo vụ.';

  return (
    <div
      id="wsp-tabpanel-thong-bao"
      role="tabpanel"
      aria-labelledby="wsp-tab-thong-bao"
    >
      <p className="wsp-notice-lead">{leadText}</p>

      {notices.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có thông báo cho đề tài này</h2>
          <p>
            Thông báo của giảng viên hướng dẫn và giáo vụ gửi đến nhóm sẽ hiện ở
            đây.
          </p>
        </section>
      ) : (
        <div className="wsp-notice-list">
          {notices.map((notice, idx) => (
            <NoticeCard key={notice.id || idx} {...notice} />
          ))}
        </div>
      )}
    </div>
  );
};
