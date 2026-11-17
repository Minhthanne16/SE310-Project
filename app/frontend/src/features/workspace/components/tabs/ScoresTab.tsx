'use client';

import React from 'react';
import type { OutlineViewerRole } from '@/types/outline';
import type { TopicDetailDto } from '@/types/topic';

interface ScoresTabProps {
  topic: TopicDetailDto;
  viewerRole: OutlineViewerRole;
}

export const ScoresTab: React.FC<ScoresTabProps> = ({ topic, viewerRole }) => {
  const isStudent = viewerRole === 'member';
  const isCompleted = topic.status === 'Đã hoàn tất';

  if (isStudent) {
    return (
      <div
        id="wsp-tabpanel-diem-so"
        role="tabpanel"
        aria-labelledby="wsp-tab-diem-so"
      >
        <section className="app-card wsp-score-card">
          <div className="wsp-score-card-header">
            <h2 className="wsp-score-card-title">Kết quả</h2>
            <span
              className={`app-chip ${
                isCompleted ? 'app-chip-active' : 'app-chip-pending'
              }`}
            >
              {isCompleted ? 'Đã công bố' : 'Chưa công bố'}
            </span>
          </div>

          <div className="wsp-score-card-content">
            {isCompleted ? (
              <div role="note" className="wsp-role-banner">
                <span className="wsp-role-banner-text">
                  Kết quả đã công bố. Bảng điểm chi tiết sẽ hiện ở đây khi hệ
                  thống có phiếu điểm.
                </span>
              </div>
            ) : (
              <p>
                Điểm hướng dẫn, phản biện, hội đồng và điểm tổng kết hiển thị
                sau khi giáo vụ công bố kết quả.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Góc nhìn Giảng viên và Giáo vụ
  const roleNoteText =
    viewerRole === 'supervisor'
      ? 'Bạn đang xem với vai trò giảng viên hướng dẫn. Ba phần chấm diễn ra song song, mỗi người chỉ nhập phiếu của mình.'
      : viewerRole === 'reviewer'
        ? 'Bạn đang xem với vai trò giảng viên phản biện, chỉ xem đề cương và bài nộp. Chấm điểm mở sau khi nhóm nộp báo cáo cuối kỳ.'
        : 'Bạn đang xem với vai trò giáo vụ, chỉ xem.';

  return (
    <div
      id="wsp-tabpanel-diem-so"
      role="tabpanel"
      aria-labelledby="wsp-tab-diem-so"
    >
      <div role="note" className="wsp-role-banner">
        <span className="wsp-role-banner-text">{roleNoteText}</span>
        <span className="wsp-role-banner-badge">SINH VIÊN KHÔNG THẤY</span>
      </div>

      <div className="wsp-scores-cards">
        <section className="app-card wsp-score-card">
          <div className="wsp-score-card-header">
            <h2 className="wsp-score-card-title">Chấm điểm hướng dẫn</h2>
            <span className="app-chip app-chip-disabled">Chưa nhập</span>
          </div>
          <p className="wsp-score-card-content">
            Phiếu chấm sẽ mở khi có chức năng chấm điểm.
          </p>
        </section>

        <section className="app-card wsp-score-card">
          <div className="wsp-score-card-header">
            <h2 className="wsp-score-card-title">Chấm điểm phản biện</h2>
            <span className="app-chip app-chip-disabled">Chưa nhập</span>
          </div>
          <p className="wsp-score-card-content">
            Phiếu chấm sẽ mở khi có chức năng chấm điểm.
          </p>
        </section>

        <section className="app-card wsp-score-card">
          <div className="wsp-score-card-header">
            <h2 className="wsp-score-card-title">Điểm hội đồng</h2>
            <span className="app-chip app-chip-disabled">Chưa nhập</span>
          </div>
          <p className="wsp-score-card-content">
            Phiếu chấm sẽ mở khi có chức năng chấm điểm.
          </p>
        </section>

        <section className="app-card wsp-total-scores-card">
          <h2 className="wsp-score-card-title">
            Điểm khóa luận (tạm tính) · theo từng sinh viên
          </h2>
          <div className="wsp-member-scores-list">
            {topic.group && topic.group.length > 0 ? (
              topic.group.map((m) => (
                <div key={m.id} className="wsp-member-score-row">
                  <span className="wsp-member-score-name">
                    {m.name} ({m.code})
                  </span>
                  <span className="wsp-member-score-status">Chưa đủ điểm</span>
                </div>
              ))
            ) : (
              <p className="wsp-score-card-content">Chưa có sinh viên.</p>
            )}
          </div>
          <p className="wsp-formula-note">
            (CTHĐ + TKHĐ + CBHD×2 + CBPB×2) / 6 · chỉ tính khi đủ 4 điểm
          </p>
        </section>
      </div>
    </div>
  );
};
