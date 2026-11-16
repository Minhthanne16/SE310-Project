'use client';

import React from 'react';
import { formatDate } from '@/features/rounds/roundUtils';
import type { TopicDetailDto } from '@/types/topic';

interface OverviewTabProps {
  topic: TopicDetailDto;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ topic }) => {
  const isProposal = topic.source === 'SV đề xuất';
  let sourceText = isProposal ? 'Sinh viên đề xuất' : 'Giảng viên gửi';
  if (topic.history && topic.history.length > 0) {
    if (isProposal) {
      const accepted = topic.history.find(
        (h) => h.action === 'Chấp nhận đề xuất',
      );
      if (accepted) {
        sourceText = `Sinh viên đề xuất · GVHD chấp nhận ${formatDate(accepted.at.slice(0, 10))}`;
      }
    } else {
      const reg = topic.history.find(
        (h) =>
          h.action === 'Ghi danh đề tài' ||
          (h.category === 'Nhóm' &&
            h.action.toLowerCase().includes('ghi danh')),
      );
      if (reg) {
        sourceText = `Giảng viên gửi · nhóm ghi danh ${formatDate(reg.at.slice(0, 10))}`;
      }
    }
  }

  const groupSizeText = `${topic.group ? topic.group.length : 0} sinh viên`;
  const outlineStatusText = topic.outlineApprovedAt
    ? `Đã duyệt ${formatDate(topic.outlineApprovedAt.slice(0, 10))}`
    : 'Chưa duyệt';

  const requirementsList = topic.requirements
    ? topic.requirements
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];

  return (
    <div
      id="wsp-tabpanel-tong-quan"
      role="tabpanel"
      aria-labelledby="wsp-tab-tong-quan"
    >
      <div className="wsp-overview-grid">
        <div className="wsp-overview-cell">
          <div className="wsp-overview-cell-label">LĨNH VỰC</div>
          <div className="wsp-overview-cell-value">{topic.field}</div>
        </div>

        <div className="wsp-overview-cell">
          <div className="wsp-overview-cell-label">NGUỒN ĐỀ TÀI</div>
          <div className="wsp-overview-cell-value">{sourceText}</div>
        </div>

        <div className="wsp-overview-cell">
          <div className="wsp-overview-cell-label">QUY MÔ NHÓM</div>
          <div className="wsp-overview-cell-value">{groupSizeText}</div>
        </div>

        <div className="wsp-overview-cell">
          <div className="wsp-overview-cell-label">TRẠNG THÁI ĐỀ CƯƠNG</div>
          <div className="wsp-overview-cell-value">{outlineStatusText}</div>
        </div>
      </div>

      <section className="wsp-overview-section">
        <h2 className="wsp-overview-section-title">Mô tả đề tài</h2>
        <div className="wsp-overview-text">{topic.description}</div>
      </section>

      {requirementsList.length > 0 && (
        <section className="wsp-overview-section">
          <h2 className="wsp-overview-section-title">Yêu cầu</h2>
          <ul className="wsp-requirements-list">
            {requirementsList.map((req, idx) => (
              <li key={idx}>{req}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
