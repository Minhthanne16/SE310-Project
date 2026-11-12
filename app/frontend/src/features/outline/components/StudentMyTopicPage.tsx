'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopicWorkspacePage } from '@/features/outline/components/TopicWorkspacePage';
import {
  studentTopicService as defaultTopics,
  type StudentTopicService,
} from '@/features/topics/services/topicApiService';
import {
  outlineService as defaultOutline,
  type OutlineService,
} from '@/features/outline/services/outlineService';

// /sv/de-tai: Không gian đề tài của nhóm trong đợt Đang diễn ra (DESIGN/01, DESIGN/03).
interface StudentMyTopicPageProps {
  topics?: Pick<StudentTopicService, 'listRounds' | 'myRegistration'>;
  outline?: OutlineService;
}

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; title: string; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'topic'; topicId: string };

export const StudentMyTopicPage: React.FC<StudentMyTopicPageProps> = ({
  topics = defaultTopics,
  outline = defaultOutline,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rounds = await topics.listRounds();
        const round = rounds.find((r) => r.status === 'Đang diễn ra');
        if (cancelled) return;
        if (!round)
          return setState({
            kind: 'empty',
            title: 'Chưa có đợt đang diễn ra',
            text: 'Bạn chưa thuộc đợt khóa luận nào đang diễn ra.',
          });
        const mine = await topics.myRegistration(round.id);
        if (cancelled) return;
        setState(
          mine.topic
            ? { kind: 'topic', topicId: mine.topic.id }
            : {
                kind: 'empty',
                title: 'Chưa có đề tài',
                text: 'Nhóm của bạn chưa ghi danh hoặc chưa được duyệt đề tài trong đợt này.',
              },
        );
      } catch (err: unknown) {
        if (!cancelled)
          setState({
            kind: 'error',
            message:
              err instanceof Error && err.message
                ? err.message
                : 'Không tải được đề tài của nhóm.',
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topics]);

  if (state.kind === 'loading')
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài của nhóm…
      </p>
    );
  if (state.kind === 'error')
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{state.message}</p>
      </section>
    );
  if (state.kind === 'empty')
    return (
      <section className="status-state app-empty">
        <h2>{state.title}</h2>
        <p>{state.text}</p>
        <Link href="/sv/dang-ky" className="status-state-action">
          Xem danh sách đề tài
        </Link>
      </section>
    );
  return (
    <TopicWorkspacePage topicId={state.topicId} service={outline} embedded />
  );
};
