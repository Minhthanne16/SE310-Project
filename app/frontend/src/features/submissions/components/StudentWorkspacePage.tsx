'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { ApiError } from '@/api/request';
import { SubmissionPanel } from '@/features/submissions/components/SubmissionPanel';
import type { SubmissionService } from '@/features/submissions/services/submissionApiService';
import {
  studentTopicService as defaultTopicService,
  type StudentTopicService,
} from '@/features/topics/services/topicApiService';
import type { TopicDto } from '@/types/topic';
import '@/features/submissions/submissions.css';

interface StudentWorkspacePageProps {
  topicService?: Pick<StudentTopicService, 'listRounds' | 'myRegistration'>;
  submissionService?: SubmissionService;
}

type State =
  | { kind: 'loading' }
  | { kind: 'no-round' }
  | { kind: 'no-topic' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; topic: TopicDto };

// "Đề tài của tôi" của sinh viên. Hiện mới có phần nộp báo cáo giữa kỳ/cuối kỳ
// (P04-S02); khung tiến độ, đề cương, thông báo và điểm thuộc các bước sau.
export const StudentWorkspacePage: React.FC<StudentWorkspacePageProps> = ({
  topicService = defaultTopicService,
  submissionService,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rounds = await topicService.listRounds();
        const round = rounds.find((r) => r.status === 'Đang diễn ra');
        if (cancelled) return;
        if (!round) return setState({ kind: 'no-round' });
        const mine = await topicService.myRegistration(round.id);
        if (cancelled) return;
        setState(
          mine.topic
            ? { kind: 'ready', topic: mine.topic }
            : { kind: 'no-topic' },
        );
      } catch (err: unknown) {
        if (!cancelled)
          setState({
            kind: 'error',
            message:
              err instanceof ApiError || err instanceof Error
                ? err.message
                : 'Không tải được đề tài của bạn.',
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topicService]);

  return (
    <div className="sub-page">
      <h1>Đề tài của tôi</h1>
      {state.kind === 'loading' ? (
        <p className="sub-muted" role="status">
          Đang tải…
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p className="sub-banner sub-banner-bad" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.kind === 'no-round' ? (
        <p className="sub-empty">
          Bạn chưa thuộc đợt khóa luận nào đang diễn ra.
        </p>
      ) : null}
      {state.kind === 'no-topic' ? (
        <p className="sub-empty">
          Nhóm của bạn chưa có đề tài.{' '}
          <Link href="/sv/dang-ky">Tìm và ghi danh đề tài</Link> trước khi nộp
          báo cáo.
        </p>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <section className="sub-topic" aria-label="Đề tài của nhóm">
            <span className="sub-muted">{state.topic.code}</span>
            <h2>{state.topic.title}</h2>
            <span className="sub-muted">
              GV hướng dẫn: {state.topic.supervisor.name} · Trạng thái:{' '}
              {state.topic.status}
            </span>
          </section>
          <SubmissionPanel
            topicId={state.topic.id}
            service={submissionService}
          />
        </>
      ) : null}
    </div>
  );
};
