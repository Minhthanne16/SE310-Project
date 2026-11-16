'use client';

import React from 'react';
import { initials } from '@/features/navigation/initials';
import type { WorkspaceTabKey } from '@/features/workspace/components/WorkspaceTabs';
import type { OutlineViewerRole } from '@/types/outline';
import type { TopicDefense, TopicDetailDto, TopicPerson } from '@/types/topic';

interface WorkspaceAsideProps {
  topic: TopicDetailDto;
  viewerRole: OutlineViewerRole;
  activeTab: WorkspaceTabKey;
}

export const WorkspaceAside: React.FC<WorkspaceAsideProps> = ({
  topic,
  viewerRole,
  activeTab,
}) => {
  const isOverview = activeTab === 'tong-quan';
  const supervisorRoleLabel =
    viewerRole === 'supervisor' ? 'Hướng dẫn · bạn' : 'Hướng dẫn';
  const reviewer = (topic as unknown as { reviewer?: TopicPerson | null })
    .reviewer;
  const defense = (topic as unknown as { defense?: TopicDefense | null })
    .defense;

  return (
    <aside className="wsp-aside" aria-label="Thông tin người tham gia và phân công">
      {/* 1. Chỉ hiện ở tab Tổng quan: Giảng viên hướng dẫn & Nhóm */}
      {isOverview && (
        <>
          <section className="app-card wsp-aside-card">
            <h2 className="wsp-aside-heading">GIẢNG VIÊN HƯỚNG DẪN</h2>
            <div className="wsp-person-item">
              <div className="wsp-person-avatar" aria-hidden="true">
                {initials(topic.supervisor.name)}
              </div>
              <div className="wsp-person-info">
                <div className="wsp-person-name">{topic.supervisor.name}</div>
                <div className="wsp-person-meta">
                  {supervisorRoleLabel} · {topic.supervisor.code}
                </div>
                {topic.supervisor.email && (
                  <a
                    href={`mailto:${topic.supervisor.email}`}
                    className="wsp-person-email"
                  >
                    {topic.supervisor.email}
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className="app-card wsp-aside-card">
            <h2 className="wsp-aside-heading">NHÓM</h2>
            {topic.group && topic.group.length > 0 ? (
              <div className="wsp-member-list">
                {topic.group.map((m) => (
                  <div key={m.id} className="wsp-person-item">
                    <div className="wsp-person-avatar" aria-hidden="true">
                      {initials(m.name)}
                    </div>
                    <div className="wsp-person-info">
                      <div className="wsp-person-name">{m.name}</div>
                      <div className="wsp-person-meta">
                        {m.representative ? 'Đại diện' : 'Thành viên'} · {m.code}
                        {m.className ? ` · ${m.className}` : ''}
                      </div>
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          className="wsp-person-email"
                        >
                          {m.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="wsp-aside-note">Chưa có nhóm ghi danh.</p>
            )}
          </section>
        </>
      )}

      {/* 2. Luôn hiện ở mọi tab: Giảng viên phản biện & Hội đồng */}
      <section className="app-card wsp-aside-card">
        <h2 className="wsp-aside-heading">GIẢNG VIÊN PHẢN BIỆN</h2>
        {reviewer ? (
          <div className="wsp-person-item">
            <div className="wsp-person-avatar" aria-hidden="true">
              {initials(reviewer.name)}
            </div>
            <div className="wsp-person-info">
              <div className="wsp-person-name">{reviewer.name}</div>
              <div className="wsp-person-meta">
                Phản biện{reviewer.code ? ` · ${reviewer.code}` : ''}
              </div>
              {reviewer.email && (
                <a
                  href={`mailto:${reviewer.email}`}
                  className="wsp-person-email"
                >
                  {reviewer.email}
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="wsp-aside-empty-label">Chưa phân công</div>
            <p className="wsp-aside-note">
              Giáo vụ phân công giảng viên phản biện sau khi đề tài được duyệt đề
              cương.
            </p>
          </>
        )}
      </section>

      <section className="app-card wsp-aside-card">
        <h2 className="wsp-aside-heading">HỘI ĐỒNG · LỊCH BẢO VỆ</h2>
        {defense ? (
          <div className="wsp-defense-info">
            <div className="wsp-defense-name">{defense.council}</div>
            <div className="wsp-aside-note">
              {defense.chair && `Chủ tịch: ${defense.chair}`}
              {defense.secretary && ` · Thư ký: ${defense.secretary}`}
            </div>
            {defense.room && (
              <div className="wsp-aside-note">
                Phòng: {defense.room}
                {defense.order ? ` · Thứ tự: ${defense.order}` : ''}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="wsp-aside-empty-label">Chưa phân công</div>
            <p className="wsp-aside-note">
              Giáo vụ sẽ thông báo hội đồng, phòng và giờ bảo vệ khi xếp lịch.
            </p>
          </>
        )}
      </section>
    </aside>
  );
};
