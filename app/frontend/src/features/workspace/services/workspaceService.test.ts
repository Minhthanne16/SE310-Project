import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import { OutlineNotFoundError } from '@/features/outline/services/outlineService';
import {
  createWorkspaceService,
  WorkspaceNotFoundError,
} from './workspaceService';
import type { Outline } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';

const mockTopic: TopicDetailDto = {
  id: 'top-1',
  roundId: 'rnd-1',
  code: 'SE101',
  title: 'Hệ thống Quản lý Khóa luận',
  status: 'Đang thực hiện',
  description: 'Mô tả chi tiết',
  requirements: 'Yêu cầu kỹ thuật',
  field: 'Kỹ thuật phần mềm',
  source: 'GV công bố',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  outlineApprovedAt: '2026-03-02T10:00:00Z',
  supervisor: {
    id: 'gv-1',
    code: 'GV001',
    name: 'TS. Nguyễn Văn A',
    email: 'nva@fit.edu.vn',
  },
  round: { id: 'rnd-1', name: 'Đợt 1 2026-2027', status: 'Đang diễn ra' },
  group: [
    {
      id: 'sv-1',
      name: 'Trần Văn B',
      code: '21520001',
      className: 'KTPM2021',
      representative: true,
      email: 'tvb@gm.uit.edu.vn',
    },
  ],
  submissions: [],
  history: [],
};

const mockOutline: Outline = {
  topicId: 'top-1',
  topicCode: 'SE101',
  topicTitle: 'Hệ thống Quản lý Khóa luận',
  viewerRole: 'member',
  deadline: '2026-03-15',
  lateDeadline: '',
  approvedAt: '2026-03-02T10:00:00Z',
  approvedBy: 'TS. Nguyễn Văn A',
  approvedVersionNo: 1,
  currentSubmissionId: null,
  canSubmit: false,
  submitBlockedReason: null,
  canReview: false,
  canApprove: false,
  approveBlockedReason: null,
  submissions: [
    {
      id: 'sub-1',
      versionNo: 1,
      fileName: 'de-cuong.pdf',
      sizeBytes: 1024,
      note: 'Bản nộp 1',
      submittedBy: 'Trần Văn B',
      submittedAt: '2026-03-01T08:00:00Z',
      late: false,
      reviewComment: 'Đề cương rất tốt.',
      reviewedBy: 'TS. Nguyễn Văn A',
      reviewedAt: '2026-03-02T10:00:00Z',
      addressedRequestIds: [],
    },
  ],
  requests: [],
};

const mockSubmissions: TopicSubmissions = {
  topicId: 'top-1',
  maxBytes: 52428800,
  kinds: [],
};

describe('workspaceService', () => {
  it('tải dữ liệu thành công cho member và kiểm tra canCancel = true khi đủ điều kiện', async () => {
    const myRegistrationMock = vi.fn().mockResolvedValue({
      canCancel: true,
      topic: { id: 'top-1' },
    });

    const service = createWorkspaceService({
      getTopic: vi.fn().mockResolvedValue(mockTopic),
      getOutline: vi.fn().mockResolvedValue(mockOutline),
      getSubmissions: vi.fn().mockResolvedValue(mockSubmissions),
      myRegistration: myRegistrationMock,
    });

    const data = await service.load('top-1');

    expect(data.topic.id).toBe('top-1');
    expect(data.outline?.approvedAt).toBe('2026-03-02T10:00:00Z');
    expect(data.submissions).toEqual(mockSubmissions);
    expect(data.viewerRole).toBe('member');
    expect(data.canCancel).toBe(true);
    expect(myRegistrationMock).toHaveBeenCalledWith('rnd-1');
  });

  it('canCancel = false khi myRegistration trả false hoặc đề tài khác', async () => {
    const service = createWorkspaceService({
      getTopic: vi.fn().mockResolvedValue(mockTopic),
      getOutline: vi.fn().mockResolvedValue(mockOutline),
      getSubmissions: vi.fn().mockResolvedValue(mockSubmissions),
      myRegistration: vi.fn().mockResolvedValue({
        canCancel: false,
        topic: { id: 'top-1' },
      }),
    });

    const data = await service.load('top-1');
    expect(data.canCancel).toBe(false);
  });

  it('không gọi myRegistration cho supervisor hoặc staff', async () => {
    const myRegistrationMock = vi.fn();
    const supervisorOutline: Outline = {
      ...mockOutline,
      viewerRole: 'supervisor',
    };

    const service = createWorkspaceService({
      getTopic: vi.fn().mockResolvedValue(mockTopic),
      getOutline: vi.fn().mockResolvedValue(supervisorOutline),
      getSubmissions: vi.fn().mockResolvedValue(mockSubmissions),
      myRegistration: myRegistrationMock,
    });

    const data = await service.load('top-1');
    expect(data.viewerRole).toBe('supervisor');
    expect(data.canCancel).toBe(false);
    expect(myRegistrationMock).not.toHaveBeenCalled();
  });

  it('ném WorkspaceNotFoundError khi getTopic trả lỗi 404', async () => {
    const service = createWorkspaceService({
      getTopic: vi.fn().mockRejectedValue(new ApiError('Not found', 404)),
      getOutline: vi.fn().mockResolvedValue(mockOutline),
      getSubmissions: vi.fn().mockResolvedValue(mockSubmissions),
    });

    await expect(service.load('top-unknown')).rejects.toThrow(
      WorkspaceNotFoundError,
    );
  });

  it('ném WorkspaceNotFoundError khi getOutline trả OutlineNotFoundError', async () => {
    const service = createWorkspaceService({
      getTopic: vi.fn().mockResolvedValue(mockTopic),
      getOutline: vi.fn().mockRejectedValue(new OutlineNotFoundError()),
      getSubmissions: vi.fn().mockResolvedValue(mockSubmissions),
    });

    await expect(service.load('top-unknown')).rejects.toThrow(
      WorkspaceNotFoundError,
    );
  });

  it('bắt lỗi khi getSubmissions bị lỗi (503/storage) mà không làm crash cả không gian đề tài', async () => {
    const service = createWorkspaceService({
      getTopic: vi.fn().mockResolvedValue(mockTopic),
      getOutline: vi.fn().mockResolvedValue(mockOutline),
      getSubmissions: vi
        .fn()
        .mockRejectedValue(new Error('MinIO service unavailable')),
      myRegistration: vi.fn().mockResolvedValue({ canCancel: false }),
    });

    const data = await service.load('top-1');
    expect(data.topic.id).toBe('top-1');
    expect(data.submissions).toBeNull();
    expect(data.submissionsError).toBe('MinIO service unavailable');
  });

  it('uỷ quyền cancelRegistration sang dependency', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined);
    const service = createWorkspaceService({
      cancelRegistration: cancelMock,
    });

    await service.cancelRegistration('top-1');
    expect(cancelMock).toHaveBeenCalledWith('top-1');
  });
});
