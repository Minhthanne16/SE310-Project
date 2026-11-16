import { ApiError, apiRequest } from '@/api/request';
import {
  OutlineNotFoundError,
  outlineService,
} from '@/features/outline/services/outlineService';
import {
  submissionService,
} from '@/features/submissions/services/submissionApiService';
import {
  studentTopicService,
} from '@/features/topics/services/topicApiService';
import type { Outline, OutlineViewerRole } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';

export class WorkspaceNotFoundError extends Error {
  constructor(message = 'Không tìm thấy đề tài.') {
    super(message);
    this.name = 'WorkspaceNotFoundError';
  }
}

export interface WorkspaceData {
  topic: TopicDetailDto;
  outline: Outline | null;
  outlineError?: string | null;
  submissions: TopicSubmissions | null;
  submissionsError?: string | null;
  viewerRole: OutlineViewerRole;
  canCancel: boolean;
}

export interface WorkspaceServiceDependencies {
  getTopic?: (topicId: string) => Promise<TopicDetailDto>;
  getOutline?: (topicId: string) => Promise<Outline>;
  getSubmissions?: (topicId: string) => Promise<TopicSubmissions>;
  myRegistration?: (
    roundId: string,
  ) => Promise<{ canCancel: boolean; topic?: { id: string } | null }>;
  cancelRegistration?: (topicId: string) => Promise<void>;
}

export interface WorkspaceService {
  load(topicId: string): Promise<WorkspaceData>;
  cancelRegistration(topicId: string): Promise<void>;
}

export function createWorkspaceService(
  deps: WorkspaceServiceDependencies = {},
): WorkspaceService {
  const getTopic =
    deps.getTopic ??
    ((topicId: string) =>
      apiRequest<TopicDetailDto>(`/topics/${encodeURIComponent(topicId)}`));

  const getOutline = deps.getOutline ?? ((topicId: string) => outlineService.get(topicId));

  const getSubmissions =
    deps.getSubmissions ?? ((topicId: string) => submissionService.list(topicId));

  const getMyReg =
    deps.myRegistration ??
    ((roundId: string) => studentTopicService.myRegistration(roundId));

  const doCancel =
    deps.cancelRegistration ??
    ((topicId: string) => studentTopicService.cancel(topicId));

  return {
    async load(topicId: string): Promise<WorkspaceData> {
      // 1. Tải song song thông tin đề tài, đề cương và bài nộp
      const topicPromise = getTopic(topicId).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          throw new WorkspaceNotFoundError();
        }
        throw err;
      });

      const outlinePromise = getOutline(topicId).catch((err: unknown) => {
        if (
          err instanceof OutlineNotFoundError ||
          (err instanceof ApiError && err.status === 404)
        ) {
          throw new WorkspaceNotFoundError();
        }
        throw err;
      });

      const submissionsPromise = getSubmissions(topicId).catch((err: unknown) => {
        // Lỗi 503 hoặc lỗi storage không làm hỏng cả trang Không gian đề tài
        return {
          error:
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được danh sách bài nộp.',
        };
      });

      const [topic, outlineResult, submissionsResult] = await Promise.all([
        topicPromise,
        outlinePromise,
        submissionsPromise,
      ]);

      const outline: Outline = outlineResult as Outline;
      const viewerRole = outline.viewerRole;

      let submissions: TopicSubmissions | null = null;
      let submissionsError: string | null = null;

      if (submissionsResult && 'error' in submissionsResult) {
        submissionsError = (submissionsResult as { error: string }).error;
      } else {
        submissions = submissionsResult as TopicSubmissions;
      }

      // 2. Nếu là thành viên nhóm (member), gọi thêm myRegistration để biết canCancel
      let canCancel = false;
      if (viewerRole === 'member' && topic.round?.id) {
        try {
          const reg = await getMyReg(topic.round.id);
          canCancel = Boolean(reg.canCancel && reg.topic?.id === topic.id);
        } catch {
          canCancel = false;
        }
      }

      return {
        topic,
        outline,
        outlineError: null,
        submissions,
        submissionsError,
        viewerRole,
        canCancel,
      };
    },

    async cancelRegistration(topicId: string): Promise<void> {
      await doCancel(topicId);
    },
  };
}

export const defaultWorkspaceService = createWorkspaceService();
