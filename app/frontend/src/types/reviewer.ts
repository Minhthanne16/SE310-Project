import type { TopicMember, TopicPerson } from '@/types/topic';

// Hợp đồng của /api/reviewer-assignments (P05-S02, PDR-062).
export interface ReviewerRound {
  id: string;
  name: string;
  status: string;
  // Mức tối đa đề tài mỗi GV của đợt; 0 = chưa đặt (chỉ cảnh báo).
  loadMax: number;
}

export interface ReviewerTopicRow {
  topicId: string;
  code: string;
  title: string;
  field: string;
  supervisor: TopicPerson;
  group: TopicMember[];
  outlineApprovedAt: string | null;
  reviewer: TopicPerson | null;
  assignedAt: string | null;
  // Đủ điều kiện phân công (PDR-021) và lý do khi chưa.
  eligible: boolean;
  blockedReason: string | null;
  // PDR-023: GVPB đã nhập phiếu đầu tiên nên không đổi được.
  locked: boolean;
  lockReason: string | null;
  hasMidterm: boolean;
  hasFinal: boolean;
}

export interface ReviewerLecturer {
  id: string;
  code: string;
  name: string;
  department: string | null;
  reviewCount: number;
  superviseCount: number;
  max: number;
  level: 'ok' | 'over';
}

export interface ReviewerAssignments {
  round: ReviewerRound;
  topics: ReviewerTopicRow[];
  lecturers: ReviewerLecturer[];
}

// Gợi ý chỉ để điền sẵn bản nháp; không ghi dữ liệu.
export interface ReviewerSuggestion {
  topicId: string;
  lecturerId: string | null;
  reason: string;
}

export interface AssignReviewerResult {
  row: ReviewerTopicRow;
  warning: string | null;
}

export interface ReviewerBatchItem {
  topicId: string;
  reviewerId: string;
  // GVPB Giáo vụ đang thấy; null nếu đề tài chưa có.
  expectedReviewerId: string | null;
}

export interface ReviewerBatchResultItem {
  topicId: string;
  code: string;
  ok: boolean;
  message: string;
  warning: string | null;
  row: ReviewerTopicRow | null;
}

export interface ReviewerBatchResult {
  succeeded: number;
  failed: number;
  results: ReviewerBatchResultItem[];
}

export interface MyReviewItem {
  topicId: string;
  code: string;
  title: string;
  group: TopicMember[];
  supervisor: TopicPerson;
  assignedAt: string | null;
  hasFinal: boolean;
  // PDR-022: được phân công và nhóm đã nộp báo cáo cuối kỳ.
  canScore: boolean;
  scoreBlockedReason: string | null;
  scored: boolean;
}

export interface MyReviews {
  rounds: ReviewerRound[];
  roundId: string | null;
  items: MyReviewItem[];
}
