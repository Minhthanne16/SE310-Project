'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import '@/features/topics/topics.css';
import '@/features/outline/outline.css';
import { OutlineSection } from '@/features/outline/components/OutlineSection';
import { SubmissionPanel } from '@/features/submissions/components/SubmissionPanel';
import {
  OutlineNotFoundError,
  outlineService as defaultService,
  type OutlineService,
} from '@/features/outline/services/outlineService';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import type { Outline } from '@/types/outline';
import type { TopicDetailDto } from '@/types/topic';

// Không gian đề tài (DESIGN/03, route /de-tai/[id]): một màn cho nhóm, GVHD và Giáo vụ;
// quyền lấy từ vai trò người xem do máy chủ trả (viewerRole). Hiện dựng phần tổng quan
// chặng Đề cương (P04-S01) và báo cáo giữa kỳ/cuối kỳ (P04-S02); các chặng sau thêm khi có API.
interface TopicWorkspacePageProps {
  topicId: string;
  service?: OutlineService;
  // Ẩn liên kết quay lại khi nhúng ở /sv/de-tai.
  embedded?: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; topic: TopicDetailDto };

const BACK: Record<
  Outline['viewerRole'],
  { href: (id: string) => string; label: string }
> = {
  member: { href: () => '/sv/de-tai', label: 'Đề tài của tôi' },
  supervisor: { href: () => '/gv/huong-dan', label: 'Nhóm hướng dẫn' },
  staff: {
    href: (id) => `/giao-vu/de-tai/${encodeURIComponent(id)}`,
    label: 'Chi tiết đề tài',
  },
};

export const TopicWorkspacePage: React.FC<TopicWorkspacePageProps> = ({
  topicId,
  service = defaultService,
  embedded = false,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [role, setRole] = useState<Outline['viewerRole'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    service
      .topic(topicId)
      .then((topic) => {
        if (!cancelled) setState({ kind: 'ready', topic });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof OutlineNotFoundError
            ? { kind: 'not-found' }
            : {
                kind: 'error',
                message:
                  err instanceof Error && err.message
                    ? err.message
                    : 'Không tải được đề tài.',
              },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [service, topicId]);

  if (state.kind === 'loading')
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài…
      </p>
    );
  if (state.kind === 'not-found')
    return (
      <section className="status-state app-empty">
        <h2>Không tìm thấy đề tài</h2>
        <p>
          Đề tài không tồn tại hoặc bạn không thuộc nhóm, không hướng dẫn đề tài
          này.
        </p>
      </section>
    );
  if (state.kind === 'error')
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{state.message}</p>
      </section>
    );

  const { topic } = state;
  const back = role ? BACK[role] : null;

  return (
    <div className="otl-page">
      {!embedded && back && (
        <Link href={back.href(topic.id)} className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="app-page-heading">
        <div className="app-heading-row">
          <h1>{topic.title}</h1>
          <TopicStatusChip status={topic.status} />
        </div>
        <p>{`${topic.code} · ${topic.field}`}</p>
      </div>

      <section className="app-card" aria-labelledby="ws-overview-title">
        <div className="app-card-header">
          <h2 id="ws-overview-title">Tổng quan đề tài</h2>
        </div>
        <dl className="otl-overview">
          <div>
            <dt>GV hướng dẫn</dt>
            <dd>{`${topic.supervisor.name} · ${topic.supervisor.code}`}</dd>
          </div>
          <div>
            <dt>Nhóm</dt>
            <dd>
              {topic.group.length === 0
                ? 'Chưa có nhóm'
                : topic.group
                    .map(
                      (m) =>
                        `${m.name} (${m.code})${m.representative ? ' · đại diện' : ''}`,
                    )
                    .join(', ')}
            </dd>
          </div>
          <div>
            <dt>Mô tả</dt>
            <dd>{topic.description}</dd>
          </div>
          {topic.requirements && (
            <div>
              <dt>Yêu cầu</dt>
              <dd>{topic.requirements}</dd>
            </div>
          )}
        </dl>
      </section>

      <OutlineSection
        topicId={topic.id}
        service={service}
        onReady={(outline) => setRole(outline.viewerRole)}
      />

      <section aria-labelledby="ws-reports-title">
        <div className="app-page-heading">
          <h2 id="ws-reports-title">Báo cáo giữa kỳ và cuối kỳ</h2>
        </div>
        <SubmissionPanel topicId={topic.id} />
      </section>
    </div>
  );
};
