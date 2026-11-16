import { describe, expect, it } from 'vitest';
import type { Outline, OutlineSubmission } from '@/types/outline';
import type { SubmissionVersion, TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';
import { buildProgress, getCurrentStage } from './workspaceProgress';

const mockOutlineSubmission = (
  overrides: Partial<OutlineSubmission> = {},
): OutlineSubmission => ({
  id: 'sub1',
  versionNo: 1,
  submittedAt: '2026-10-24T00:00:00Z',
  submittedBy: 'sv1',
  fileName: 'decuong.pdf',
  sizeBytes: 1000,
  note: null,
  late: false,
  reviewComment: null,
  reviewedAt: null,
  reviewedBy: null,
  addressedRequestIds: [],
  ...overrides,
});

const mockTopic = (
  overrides: Partial<TopicDetailDto> = {},
): TopicDetailDto => ({
  id: 't1',
  roundId: 'r1',
  round: { id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra' },
  code: 'DT-001',
  title: 'Hệ thống gợi ý',
  field: 'Trí tuệ nhân tạo',
  description: 'Mô tả',
  requirements: null,
  supervisor: {
    id: 'gv1',
    code: 'GV0001',
    name: 'Trần Văn GV',
    email: 'gv@test.com',
  },
  source: 'GV công bố',
  status: 'Đang thực hiện',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  group: [
    {
      id: 'sv1',
      code: '22520001',
      name: 'Nguyễn Văn SV',
      className: 'KTPM2022',
      representative: true,
      email: 'sv@test.com',
    },
  ],
  outlineApprovedAt: null,
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

const mockVersion = (
  overrides: Partial<SubmissionVersion> = {},
): SubmissionVersion => ({
  id: 'v1',
  version: 1,
  fileName: 'bc.pdf',
  sizeBytes: 2000,
  note: null,
  submittedAt: '2026-11-04T00:00:00Z',
  submittedBy: { id: 'sv1', code: '22520001', name: 'Nguyễn Văn SV' },
  isLate: false,
  isLatest: true,
  isFinal: false,
  downloadUrl: '/api/submissions/v1/file',
  reviewComment: null,
  reviewedBy: null,
  reviewedAt: null,
  addressedRequestIds: [],
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
  ...overrides,
});

describe('workspaceProgress', () => {
  it('1. Đề tài chưa nộp đề cương: Đề cương là chặng hiện tại với bước "Chưa nộp"', () => {
    const topic = mockTopic();
    const outline = mockOutline({ submissions: [], deadline: '2026-10-20' });
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows).toHaveLength(6);

    // ĐĂNG KÝ
    expect(rows[0].steps).toEqual([{ text: 'Đã ghi danh', kind: 'done' }]);

    // ĐỀ CƯƠNG
    expect(rows[1].steps).toEqual([{ text: 'Chưa nộp', kind: 'now' }]);
    expect(rows[1].note).toBe('Hạn nộp 20/10/2026');

    // GIỮA KỲ chưa mở vì đề cương chưa duyệt
    expect(rows[2].steps).toEqual([{ text: 'Chưa mở', kind: 'todo' }]);
    expect(rows[2].note).toBe('Mở sau khi đề cương được duyệt');

    // CUỐI KỲ chưa mở
    expect(rows[3].steps).toEqual([{ text: 'Chưa mở', kind: 'todo' }]);

    const stage = getCurrentStage(rows);
    expect(stage?.collapsedText).toBe('Đề cương · Chưa nộp');
  });

  it('2. Đã nộp đề cương và đang chờ GVHD duyệt', () => {
    const topic = mockTopic();
    const outline = mockOutline({
      submissions: [
        {
          id: 'sub1',
          versionNo: 1,
          submittedAt: '2026-10-15T00:00:00Z',
          submittedBy: 'sv1',
          fileName: 'decuong.pdf',
          sizeBytes: 1000,
          note: null,
          late: false,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          addressedRequestIds: [],
        },
      ],
      requests: [],
      approvedAt: null,
    });
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[1].steps).toEqual([
      { text: 'Đã nộp · lần 1', kind: 'done' },
      { text: 'Chờ GVHD duyệt', kind: 'now' },
    ]);

    const stage = getCurrentStage(rows);
    expect(stage?.collapsedText).toBe('Đề cương · Chờ GVHD duyệt');
  });

  it('3. Đề cương có 2 yêu cầu chỉnh sửa đang mở', () => {
    const topic = mockTopic();
    const outline = mockOutline({
      submissions: [
        {
          id: 'sub1',
          versionNo: 1,
          submittedAt: '2026-10-15T00:00:00Z',
          submittedBy: 'sv1',
          fileName: 'decuong.pdf',
          sizeBytes: 1000,
          note: null,
          late: false,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          addressedRequestIds: [],
        },
      ],
      requests: [
        {
          id: 'req1',
          content: 'Sửa mục tiêu',
          createdBy: 'gv1',
          createdAt: '2026-10-16T00:00:00Z',
          raisedOnVersionNo: 1,
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
          addressedInVersions: [],
          canResolve: false,
        },
        {
          id: 'req2',
          content: 'Thêm phương pháp',
          createdBy: 'gv1',
          createdAt: '2026-10-16T00:00:00Z',
          raisedOnVersionNo: 1,
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
          addressedInVersions: [],
          canResolve: false,
        },
      ],
    });
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[1].steps).toEqual([
      { text: 'Đã nộp · lần 1', kind: 'done' },
      { text: 'Cần chỉnh sửa · 2 yêu cầu', kind: 'now' },
    ]);

    const stage = getCurrentStage(rows);
    expect(stage?.collapsedText).toBe('Đề cương · Cần chỉnh sửa · 2 yêu cầu');
  });

  it('4. Đã duyệt đề cương + Giữa kỳ bị khóa nộp', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({
      approvedAt: '2026-10-25T00:00:00Z',
      approvedVersionNo: 2,
      submissions: [
        {
          id: 'sub2',
          versionNo: 2,
          submittedAt: '2026-10-24T00:00:00Z',
          submittedBy: 'sv1',
          fileName: 'decuong_v2.pdf',
          sizeBytes: 1000,
          note: null,
          late: false,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          addressedRequestIds: [],
        },
      ],
    });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
          allowLate: false,
          lateDeadline: '',
          window: 'closed',
          canSubmit: false,
          blockedReason: 'Đã hết hạn nộp',
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
          deadline: '2026-12-05',
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

    const rows = buildProgress({ topic, outline, submissions });
    // Đề cương đã duyệt
    expect(rows[1].steps).toEqual([
      { text: 'Đã nộp · lần 1', kind: 'done' },
      { text: 'GVHD đã duyệt', kind: 'done' },
    ]);

    // Giữa kỳ khóa nộp
    expect(rows[2].steps).toEqual([
      { text: 'Chưa nộp · đã khóa nộp', kind: 'now' },
      { text: 'GVHD nhận xét', kind: 'todo' },
    ]);
    expect(rows[2].note).toBe('Hạn nộp 05/11/2026');

    const stage = getCurrentStage(rows);
    expect(stage?.collapsedText).toBe('Giữa kỳ · Chưa nộp · đã khóa nộp');
  });

  it('5. Giữa kỳ nộp trễ được ghi nhận nhãn Nộp trễ', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
          allowLate: true,
          lateDeadline: '2026-11-10',
          window: 'late',
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
          requests: [],
          versions: [
            mockVersion({
              id: 'v1',
              version: 1,
              fileName: 'bcgk.pdf',
              submittedAt: '2026-11-08T00:00:00Z',
              isLate: true,
              isLatest: true,
              isFinal: false,
              downloadUrl: '/api/submissions/v1/file',
            }),
          ],
        },
      ],
    });

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[2].steps[0]).toEqual({
      text: 'Đã nộp · bản 1 · Nộp trễ',
      kind: 'done',
    });
  });

  it('6. Cuối kỳ có 3 phiên bản', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
          allowLate: false,
          lateDeadline: '',
          window: 'closed',
          canSubmit: false,
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
          requests: [],
          versions: [
            mockVersion({
              id: 'mv1',
              version: 1,
              fileName: 'bcgk.pdf',
              submittedAt: '2026-11-04T00:00:00Z',
              downloadUrl: '/api/submissions/mv1/file',
            }),
          ],
        },
        {
          kind: 'final',
          name: 'Báo cáo cuối kỳ',
          deadline: '2026-12-05',
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
          requests: [],
          versions: [
            mockVersion({
              id: 'fv3',
              version: 3,
              fileName: 'bckk_v3.pdf',
              sizeBytes: 3000,
              note: 'Sửa kết luận',
              submittedAt: '2026-12-04T00:00:00Z',
              isLatest: true,
              isFinal: false,
              downloadUrl: '/api/submissions/fv3/file',
            }),
            mockVersion({
              id: 'fv2',
              version: 2,
              fileName: 'bckk_v2.pdf',
              sizeBytes: 2900,
              note: 'Sửa bảng số liệu',
              submittedAt: '2026-12-02T00:00:00Z',
              isLatest: false,
              downloadUrl: '/api/submissions/fv2/file',
            }),
            mockVersion({
              id: 'fv1',
              version: 1,
              fileName: 'bckk_v1.pdf',
              sizeBytes: 2800,
              note: 'Bản nộp đầu',
              submittedAt: '2026-12-01T00:00:00Z',
              isLatest: false,
              downloadUrl: '/api/submissions/fv1/file',
            }),
          ],
        },
      ],
    });

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[3].steps).toEqual([
      { text: 'Đã nộp · 3 phiên bản', kind: 'done' },
      { text: 'Chốt bản cuối', kind: 'todo' },
    ]);
  });

  it('7. Trạng thái "Đã xác nhận": Đánh giá done, Kết quả có 2 bước done', () => {
    const topic = mockTopic({
      status: 'Đã xác nhận',
      outlineApprovedAt: '2026-10-25T00:00:00Z',
    });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    // ĐÁNH GIÁ (cả 3 phiếu done)
    expect(rows[4].steps).toEqual([
      { text: 'Điểm hướng dẫn', kind: 'done' },
      { text: 'Điểm phản biện', kind: 'done' },
      { text: 'Điểm hội đồng', kind: 'done' },
    ]);
    expect(rows[4].parallel).toBe(true);

    // KẾT QUẢ
    expect(rows[5].steps).toEqual([
      { text: 'Đã cho điểm', kind: 'done' },
      { text: 'Xác nhận kết quả', kind: 'done' },
      { text: 'Công bố · hoàn tất', kind: 'todo' },
    ]);
  });

  it('8. Trạng thái "Đã hoàn tất": Toàn bộ các bước kết quả done', () => {
    const topic = mockTopic({
      status: 'Đã hoàn tất',
      outlineApprovedAt: '2026-10-25T00:00:00Z',
    });
    const outline = mockOutline({ approvedAt: '2026-10-25T00:00:00Z' });
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[5].steps).toEqual([
      { text: 'Đã cho điểm', kind: 'done' },
      { text: 'Xác nhận kết quả', kind: 'done' },
      { text: 'Công bố · hoàn tất', kind: 'done' },
    ]);
  });

  it('9. Trạng thái "Không đủ điều kiện công bố": KẾT QUẢ hiển thị một bước đặc biệt', () => {
    const topic = mockTopic({ status: 'Không đủ điều kiện công bố' });
    const outline = mockOutline();
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[5].steps).toEqual([
      { text: 'Không đủ điều kiện công bố', kind: 'now' },
    ]);
  });

  it('10. Đề tài "Không có nhóm": buildProgress trả về mảng rỗng', () => {
    const topic = mockTopic({ status: 'Không có nhóm', group: [] });
    const outline = mockOutline();
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows).toEqual([]);
  });

  it('11. Đề tài SV đề xuất: bước 1 ghi "Đề xuất được chấp nhận"', () => {
    const topic = mockTopic({ source: 'SV đề xuất' });
    const outline = mockOutline();
    const submissions = mockSubmissions();

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[0].steps).toEqual([
      { text: 'Đề xuất được chấp nhận', kind: 'done' },
    ]);
  });

  it('12. R1: Giữa kỳ đã nhận xét và không còn yêu cầu mở: bước 2 done, tiến độ chuyển sang Cuối kỳ', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({
      approvedAt: '2026-10-25T00:00:00Z',
      submissions: [mockOutlineSubmission()],
    });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
          allowLate: false,
          lateDeadline: '',
          window: 'closed',
          canSubmit: false,
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
          requests: [],
          versions: [
            mockVersion({
              id: 'mv1',
              version: 1,
              fileName: 'bcgk.pdf',
              submittedAt: '2026-11-04T00:00:00Z',
              reviewComment: 'Báo cáo đạt yêu cầu',
              reviewedBy: 'GVHD',
              reviewedAt: '2026-11-05T00:00:00Z',
            }),
          ],
        },
        {
          kind: 'final',
          name: 'Báo cáo cuối kỳ',
          deadline: '2026-12-05',
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
          requests: [],
          versions: [],
        },
      ],
    });

    const rows = buildProgress({ topic, outline, submissions });
    // Giữa kỳ: cả 2 bước đều done
    expect(rows[2].steps).toEqual([
      { text: 'Đã nộp · bản 1', kind: 'done' },
      { text: 'GVHD đã nhận xét', kind: 'done' },
    ]);

    // Chặng hiện tại không bị kẹt ở Giữa kỳ mà đã sang Cuối kỳ
    const stage = getCurrentStage(rows);
    expect(stage?.rowKey).toBe('final');
    expect(stage?.collapsedText).toBe('Cuối kỳ · Chưa nộp');
  });

  it('13. R1: Giữa kỳ còn yêu cầu chỉnh sửa mở: bước 2 now với nhãn Cần chỉnh sửa', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({
      approvedAt: '2026-10-25T00:00:00Z',
      submissions: [mockOutlineSubmission()],
    });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
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
            mockVersion({
              id: 'mv1',
              version: 1,
              fileName: 'bcgk.pdf',
              submittedAt: '2026-11-04T00:00:00Z',
            }),
          ],
          requests: [
            {
              id: 'r1',
              content: 'Sửa phương pháp',
              createdBy: 'GVHD',
              createdAt: '2026-11-05T00:00:00Z',
              raisedOnVersionNo: 1,
              status: 'open',
              resolvedBy: null,
              resolvedAt: null,
              addressedInVersions: [],
              canResolve: false,
            },
            {
              id: 'r2',
              content: 'Bổ sung kết quả',
              createdBy: 'GVHD',
              createdAt: '2026-11-05T00:00:00Z',
              raisedOnVersionNo: 1,
              status: 'open',
              resolvedBy: null,
              resolvedAt: null,
              addressedInVersions: [],
              canResolve: false,
            },
          ],
        },
      ],
    });

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[2].steps).toEqual([
      { text: 'Đã nộp · bản 1', kind: 'done' },
      { text: 'Cần chỉnh sửa · 2 yêu cầu', kind: 'now' },
    ]);

    const stage = getCurrentStage(rows);
    expect(stage?.rowKey).toBe('midterm');
    expect(stage?.collapsedText).toBe('Giữa kỳ · Cần chỉnh sửa · 2 yêu cầu');
  });

  it('14. R1: Giữa kỳ đã nộp nhưng chưa có nhận xét: bước 2 todo', () => {
    const topic = mockTopic({ outlineApprovedAt: '2026-10-25T00:00:00Z' });
    const outline = mockOutline({
      approvedAt: '2026-10-25T00:00:00Z',
      submissions: [mockOutlineSubmission()],
    });
    const submissions = mockSubmissions({
      kinds: [
        {
          kind: 'midterm',
          name: 'Báo cáo giữa kỳ',
          deadline: '2026-11-05',
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
          requests: [],
          versions: [
            mockVersion({
              id: 'mv1',
              version: 1,
              fileName: 'bcgk.pdf',
              submittedAt: '2026-11-04T00:00:00Z',
              reviewComment: null,
            }),
          ],
        },
      ],
    });

    const rows = buildProgress({ topic, outline, submissions });
    expect(rows[2].steps).toEqual([
      { text: 'Đã nộp · bản 1', kind: 'done' },
      { text: 'GVHD nhận xét', kind: 'todo' },
    ]);

    const stage = getCurrentStage(rows);
    expect(stage?.rowKey).toBe('midterm');
    expect(stage?.collapsedText).toBe('Giữa kỳ · GVHD nhận xét');
  });
});
