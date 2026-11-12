// Hợp đồng của GET|POST /api/topics/{id}/submissions (PDR-056). Tệp nằm trong
// object storage riêng tư của backend; frontend chỉ nhận đường dẫn API.
export type SubmissionKind = 'midterm' | 'final';
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
  // /api/submissions/{id}/file, có kiểm tra quyền ở backend.
  downloadUrl: string;
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
  // Mới nhất trước.
  versions: SubmissionVersion[];
}

export interface TopicSubmissions {
  topicId: string;
  maxBytes: number;
  kinds: SubmissionKindState[];
}
