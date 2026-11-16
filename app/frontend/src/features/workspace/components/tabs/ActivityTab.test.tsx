import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Outline } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';
import { ActivityTab } from './ActivityTab';

afterEach(cleanup);

const mockTopic = (
  overrides: Partial<TopicDetailDto> = {},
): TopicDetailDto => ({
  id: 't1',
  roundId: 'r1',
  round: { id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra' },
  code: 'DT-001',
  title: 'Hệ thống gợi ý',
  field: 'CNPM',
  description: 'Mô tả',
  requirements: null,
  supervisor: {
    id: 'gv1',
    code: 'GV001',
    name: 'Trần Văn GV',
    email: 'gv@test.com',
  },
  source: 'GV công bố',
  status: 'Đang thực hiện',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  outlineApprovedAt: null,
  group: [],
  submissions: [],
  history: [],
  ...overrides,
});

const mockOutline = (overrides: Partial<Outline> = {}): Outline => ({
  topicId: 't1',
  topicCode: 'DT-001',
  topicTitle: 'Hệ thống gợi ý',
  viewerRole: 'member',
  deadline: '2026-10-20',
  lateDeadline: '',
  approvedAt: null,
  approvedBy: null,
  approvedVersionNo: null,
  currentSubmissionId: null,
  canSubmit: true,
  submitBlockedReason: null,
  canReview: false,
  canApprove: false,
  approveBlockedReason: null,
  submissions: [],
  requests: [],
  ...overrides,
});

const mockSubmissions = (
  overrides: Partial<TopicSubmissions> = {},
): TopicSubmissions => ({
  topicId: 't1',
  maxBytes: 20 * 1024 * 1024,
  kinds: [
    {
      kind: 'midterm',
      name: 'Báo cáo giữa kỳ',
      deadline: '2026-11-10',
      allowLate: false,
      lateDeadline: '',
      window: 'onTime',
      canSubmit: true,
      blockedReason: null,
      noteRequired: false,
      canReview: false,
      canLock: false,
      extensionDeadline: '',
      extensionReason: null,
      waitingException: false,
      canGrantExtension: false,
      canMarkIneligible: false,
      ineligibleReason: null,
      versions: [],
      requests: [],
    },
    {
      kind: 'final',
      name: 'Báo cáo cuối kỳ',
      deadline: '2026-12-10',
      allowLate: false,
      lateDeadline: '',
      window: 'closed',
      canSubmit: false,
      blockedReason: null,
      noteRequired: true,
      canReview: false,
      canLock: false,
      extensionDeadline: '',
      extensionReason: null,
      waitingException: false,
      canGrantExtension: false,
      canMarkIneligible: false,
      ineligibleReason: null,
      versions: [],
      requests: [],
    },
  ],
  ...overrides,
});

describe('ActivityTab', () => {
  it('hiển thị thông báo khóa khi đề cương chưa được duyệt', () => {
    const topic = mockTopic();
    const outline = mockOutline();
    const submissions = mockSubmissions();

    render(
      <ActivityTab topic={topic} outline={outline} submissions={submissions} />,
    );

    // Mặc định khối Đề cương mở khi chưa duyệt
    expect(
      screen.getByRole('heading', { name: 'Đề cương' }),
    ).toBeInTheDocument();

    // Mở accordion Giữa kỳ
    const midtermButton = screen.getByRole('button', {
      name: /Báo cáo giữa kỳ/,
    });
    fireEvent.click(midtermButton);

    expect(
      screen.getByText(
        /Mục nộp báo cáo giữa kỳ mở sau khi giảng viên hướng dẫn duyệt đề cương/,
      ),
    ).toBeInTheDocument();
  });

  it('hiển thị chip "Cần chỉnh sửa · k yêu cầu" khi chặng giữa kỳ hoặc cuối kỳ có yêu cầu mở', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-10',
          allowLate: false,
          lateDeadline: '',
          window: 'onTime',
          canSubmit: true,
          blockedReason: null,
          noteRequired: false,
          canReview: false,
          canLock: false,
          extensionDeadline: '',
          extensionReason: null,
          waitingException: false,
          canGrantExtension: false,
          canMarkIneligible: false,
          ineligibleReason: null,
          versions: [
            {
              id: 'v1',
              version: 1,
              fileName: 'bcgk.pdf',
              sizeBytes: 1000,
              note: null,
              submittedAt: '2026-11-05T00:00:00Z',
              submittedBy: { id: 'sv1', code: 'SV01', name: 'Sinh viên' },
              isLate: false,
              isLatest: true,
              isFinal: false,
              downloadUrl: '/api/submissions/v1/file',
              reviewComment: null,
              reviewedBy: null,
              reviewedAt: null,
              addressedRequestIds: [],
            },
          ],
          requests: [
            {
              id: 'req1',
              content: 'Sửa mục tiêu',
              createdBy: 'GVHD',
              createdAt: '2026-11-06T00:00:00Z',
              raisedOnVersionNo: 1,
              status: 'open',
              resolvedBy: null,
              resolvedAt: null,
              addressedInVersions: [],
              canResolve: false,
            },
            {
              id: 'req2',
              content: 'Bổ sung bảng khảo sát',
              createdBy: 'GVHD',
              createdAt: '2026-11-06T00:00:00Z',
              raisedOnVersionNo: 1,
              status: 'open',
              resolvedBy: null,
              resolvedAt: null,
              addressedInVersions: [],
              canResolve: false,
            },
          ],
        },
        {
          kind: 'final',
          name: 'Báo cáo cuối kỳ',
          deadline: '2026-12-10',
          allowLate: false,
          lateDeadline: '',
          window: 'onTime',
          canSubmit: true,
          blockedReason: null,
          noteRequired: true,
          canReview: false,
          canLock: false,
          extensionDeadline: '',
          extensionReason: null,
          waitingException: false,
          canGrantExtension: false,
          canMarkIneligible: false,
          ineligibleReason: null,
          versions: [],
          requests: [],
        },
      ],
    });

    render(
      <ActivityTab topic={topic} outline={outline} submissions={submissions} />,
    );

    // Chip giữa kỳ hiển thị: "Cần chỉnh sửa · 2 yêu cầu"
    expect(screen.getByText('Cần chỉnh sửa · 2 yêu cầu')).toBeInTheDocument();
  });

  it('toggle được các accordion section', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions();

    render(
      <ActivityTab topic={topic} outline={outline} submissions={submissions} />,
    );

    const outlineHeaderBtn = screen.getByRole('button', { name: /Đề cương/ });
    expect(outlineHeaderBtn).toHaveAttribute('aria-expanded', 'false');

    // Bấm mở Đề cương
    fireEvent.click(outlineHeaderBtn);
    expect(outlineHeaderBtn).toHaveAttribute('aria-expanded', 'true');

    // Bấm đóng lại
    fireEvent.click(outlineHeaderBtn);
    expect(outlineHeaderBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
