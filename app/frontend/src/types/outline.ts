// Đề cương và yêu cầu chỉnh sửa của một đề tài (P04-S01, PDR-013, PDR-057).
// Khớp OutlineDto của GET /api/topics/{id}/outline; thời điểm là ISO UTC.

export type OutlineViewerRole = 'member' | 'supervisor' | 'staff';

export interface OutlineSubmission {
  id: string;
  versionNo: number;
  fileName: string;
  sizeBytes: number;
  note: string | null;
  submittedBy: string;
  submittedAt: string;
  // Nộp trong hạn trễ riêng của mốc (PDR-041).
  late: boolean;
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  // Yêu cầu đang mở lúc nộp mà phiên bản này xử lý.
  addressedRequestIds: string[];
}

export interface RevisionRequest {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
  raisedOnVersionNo: number;
  status: 'open' | 'resolved';
  resolvedBy: string | null;
  resolvedAt: string | null;
  addressedInVersions: number[];
  // GVHD đóng được: còn mở và nhóm đã nộp lại sau khi tạo.
  canResolve: boolean;
}

export interface Outline {
  topicId: string;
  topicCode: string;
  topicTitle: string;
  viewerRole: OutlineViewerRole;
  // yyyy-MM-dd hoặc rỗng.
  deadline: string;
  lateDeadline: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedVersionNo: number | null;
  // Phiên bản mới nhất, đang chờ GVHD xử lý; null khi chưa nộp.
  currentSubmissionId: string | null;
  canSubmit: boolean;
  submitBlockedReason: string | null;
  canReview: boolean;
  canApprove: boolean;
  approveBlockedReason: string | null;
  // Mới nhất trước.
  submissions: OutlineSubmission[];
  // Yêu cầu mở trước.
  requests: RevisionRequest[];
}

// Tóm tắt đề cương trên danh sách đề tài của GVHD (/api/topics/mine).
export interface OutlineSummary {
  versions: number;
  openRequests: number;
  // Phiên bản mới nhất đang chờ GVHD nhận xét, tạo yêu cầu hoặc duyệt.
  awaitingReview: boolean;
}
