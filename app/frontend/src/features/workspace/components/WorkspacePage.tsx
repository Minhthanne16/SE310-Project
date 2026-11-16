'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '@/features/workspace/workspace.css';
import '@/features/topics/topics.css';
import '@/features/outline/outline.css';
import '@/features/submissions/submissions.css';
import { useUrlParam } from '@/lib/useUrlParam';
import {
  type WorkspaceData,
  type WorkspaceService,
  WorkspaceNotFoundError,
  defaultWorkspaceService,
} from '@/features/workspace/services/workspaceService';
import { buildProgress } from '@/features/workspace/workspaceProgress';
import { WorkspaceHeader } from '@/features/workspace/components/WorkspaceHeader';
import { ProgressPanel } from '@/features/workspace/components/ProgressPanel';
import {
  WorkspaceTabs,
  type WorkspaceTabKey,
} from '@/features/workspace/components/WorkspaceTabs';
import { WorkspaceAside } from '@/features/workspace/components/WorkspaceAside';
import { OverviewTab } from '@/features/workspace/components/tabs/OverviewTab';
import { NoticeTab } from '@/features/workspace/components/tabs/NoticeTab';
import { ActivityTab } from '@/features/workspace/components/tabs/ActivityTab';
import { ScoresTab } from '@/features/workspace/components/tabs/ScoresTab';
import type { OutlineService } from '@/features/outline/services/outlineService';
import type { SubmissionService } from '@/features/submissions/services/submissionApiService';
import type { Outline } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';

export interface WorkspacePageProps {
  topicId: string;
  service?: WorkspaceService;
  outlineService?: OutlineService;
  submissionService?: SubmissionService;
  embedded?: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: WorkspaceData };

const VALID_TABS: WorkspaceTabKey[] = [
  'tong-quan',
  'thong-bao',
  'hoat-dong',
  'diem-so',
];

const WorkspaceInner: React.FC<WorkspacePageProps> = ({
  topicId,
  service = defaultWorkspaceService,
  outlineService,
  submissionService,
  embedded = false,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tabParam, setTabParam] = useUrlParam('tab');

  const activeTab: WorkspaceTabKey =
    tabParam && VALID_TABS.includes(tabParam as WorkspaceTabKey)
      ? (tabParam as WorkspaceTabKey)
      : 'hoat-dong';

  const loadData = useCallback(async () => {
    try {
      const data = await service.load(topicId);
      setState({ kind: 'ready', data });
    } catch (err: unknown) {
      if (err instanceof WorkspaceNotFoundError) {
        setState({ kind: 'not-found' });
      } else {
        setState({
          kind: 'error',
          message:
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được đề tài.',
        });
      }
    }
  }, [service, topicId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài…
      </p>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <section className="status-state app-empty">
        <h2>Không tìm thấy đề tài</h2>
        <p>
          Đề tài không tồn tại hoặc bạn không có quyền xem đề tài này.
        </p>
        <Link href="/sv/dang-ky" className="status-state-action">
          Về trang danh sách đề tài
        </Link>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{state.message}</p>
        <button
          type="button"
          className="app-button"
          onClick={() => {
            setState({ kind: 'loading' });
            void loadData();
          }}
        >
          Thử lại
        </button>
      </section>
    );
  }

  const {
    topic,
    outline,
    submissions,
    submissionsError,
    viewerRole,
    canCancel,
  } = state.data;
  const noGroup = topic.status === 'Không có nhóm';
  const progressRows = buildProgress({ topic, outline, submissions });

  // Tổng số lượng yêu cầu mở trên cả 3 chặng: Đề cương, Giữa kỳ, Cuối kỳ (PDR-060)
  const outlineApproved = Boolean(topic.outlineApprovedAt || outline?.approvedAt);
  const outlineOpenCount = !outlineApproved && outline?.requests
    ? outline.requests.filter((r) => r.status === 'open').length
    : 0;
  const submissionsOpenCount = (submissions?.kinds ?? []).reduce((acc, k) => {
    return acc + (k.requests ?? []).filter((r) => r.status === 'open').length;
  }, 0);
  const openRequestsCount = outlineOpenCount + submissionsOpenCount;

  const handleOutlineReady = (updatedOutline: Outline) => {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      const updatedTopic = { ...prev.data.topic };
      if (updatedOutline.approvedAt) {
        updatedTopic.outlineApprovedAt = updatedOutline.approvedAt;
      }
      return {
        kind: 'ready',
        data: {
          ...prev.data,
          topic: updatedTopic,
          outline: updatedOutline,
        },
      };
    });
  };

  const handleSubmissionsChanged = (updatedSubmissions: TopicSubmissions) => {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        kind: 'ready',
        data: {
          ...prev.data,
          submissions: updatedSubmissions,
        },
      };
    });
  };

  const handleConfirmCancel = async (cancelTopicId: string) => {
    await service.cancelRegistration(cancelTopicId);
  };

  return (
    <div className="wsp-page">
      <WorkspaceHeader
        topic={topic}
        viewerRole={viewerRole}
        canCancel={canCancel}
        embedded={embedded}
        onConfirmCancel={handleConfirmCancel}
      />

      <ProgressPanel rows={progressRows} noGroup={noGroup} />

      <WorkspaceTabs
        activeTab={activeTab}
        onTabChange={(nextTab) => setTabParam(nextTab, 'replace')}
        openRequestsCount={openRequestsCount}
      />

      <div className="wsp-layout">
        <div className="wsp-main-col">
          {activeTab === 'tong-quan' && <OverviewTab topic={topic} />}
          {activeTab === 'thong-bao' && <NoticeTab viewerRole={viewerRole} />}
          {activeTab === 'hoat-dong' && (
            <ActivityTab
              topic={topic}
              outline={outline}
              submissions={submissions}
              submissionsError={submissionsError}
              outlineService={outlineService}
              submissionService={submissionService}
              onOutlineReady={handleOutlineReady}
              onSubmissionsChanged={handleSubmissionsChanged}
            />
          )}
          {activeTab === 'diem-so' && (
            <ScoresTab topic={topic} viewerRole={viewerRole} />
          )}
        </div>

        <WorkspaceAside
          topic={topic}
          viewerRole={viewerRole}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
};

export const WorkspacePage: React.FC<WorkspacePageProps> = (props) => (
  <Suspense
    fallback={
      <p role="status" className="app-muted">
        Đang tải đề tài…
      </p>
    }
  >
    <WorkspaceInner {...props} />
  </Suspense>
);
