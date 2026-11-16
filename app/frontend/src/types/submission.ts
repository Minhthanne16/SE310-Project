import type { RevisionRequest } from './outline';

// Hợp đồng của GET|POST /api/topics/{id}/submissions (PDR-056, PDR-060). Tệp nằm trong
// object storage riêng tư của backend; frontend chỉ nhận đường dẫn API.
export type SubmissionKind = 'midterm' | 'final' | 'thesis';
export type SubmissionWindow = 'onTime' | 'late' | 'closed';

export interface SubmissionVersion {
  id: string;
  version: number;
  fileName: string;
  sizeBytes: number;
  note: string | null;
  // ISO UTC.
  submittedAt: string;
  submittedBy: { id: string; code: string; name: string };
  isLate: boolean;
  isLatest: boolean;
  isFinal: boolean;
  // /api/submissions/{id}/file, có kiểm tra quyền ở backend.
  downloadUrl: string;
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  addressedRequestIds: string[];
}

export interface SubmissionKindState {
  kind: SubmissionKind;
  name: string;
  // yyyy-MM-dd; rỗng nếu mốc chưa đặt ngày.
  deadline: string;
  allowLate: boolean;
  // Hạn trễ đang có hiệu lực (PDR-041); rỗng khi mốc không cho nộp trễ.
  lateDeadline: string;
  window: SubmissionWindow;
  // Chỉ true với thành viên nhóm khi mốc còn nhận bài.
  canSubmit: boolean;
  blockedReason: string | null;
  noteRequired: boolean;
  canReview: boolean;
  canLock: boolean;
  // Lý do chưa chốt được bản cuối: còn yêu cầu chỉnh sửa Cuối kỳ mở (PDR-060).
  lockBlockedReason: string | null;
  extensionDeadline: string;
  extensionReason: string | null;
  waitingException: boolean;
  canGrantExtension: boolean;
  canMarkIneligible: boolean;
  ineligibleReason: string | null;
  // Mới nhất trước.
  versions: SubmissionVersion[];
  // Yêu cầu mở trước, rồi theo thời điểm tạo mới nhất.
  requests: RevisionRequest[];
}

export interface TopicSubmissions {
  topicId: string;
  maxBytes: number;
  kinds: SubmissionKindState[];
}
