// Đề tài khóa luận (docs/DESIGN/03: Quản lý đề tài, Chi tiết đề tài của giáo
// vụ). Backend chưa có API đề tài nên các kiểu dưới đây do frontend đề xuất và
// chạy trên kho demo (features/topics/services/topicService.ts).
import type { RoundStatus, TopicStatus } from '@/types/round';

export { TOPIC_STATUSES, type TopicStatus } from '@/types/round';

export const TOPIC_SOURCES = ['GV công bố', 'SV đề xuất'] as const;
export type TopicSource = (typeof TOPIC_SOURCES)[number];

// Giai đoạn đề tài của MỘT đợt, tách khỏi trạng thái đợt (03: Đề tài của tôi).
// Công bố danh sách không đảo ngược được.
export const TOPIC_PHASES = [
  'Đang gửi đề tài',
  'Đã công bố danh sách',
] as const;
export type TopicPhase = (typeof TOPIC_PHASES)[number];

export const SUBMISSION_KINDS = [
  'Đề cương',
  'Giữa kỳ',
  'Cuối kỳ',
  'Bản khóa luận',
] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

// Bốn phiếu điểm: chủ tịch HĐ, thư ký HĐ, GV hướng dẫn, GV phản biện.
export const SCORE_ROLES = ['CTHĐ', 'TKHĐ', 'CBHD', 'CBPB'] as const;
export type ScoreRole = (typeof SCORE_ROLES)[number];

export const HISTORY_CATEGORIES = [
  'Trạng thái',
  'Nhóm',
  'Bài nộp',
  'Phân công',
  'Điểm',
] as const;
export type HistoryCategory = (typeof HISTORY_CATEGORIES)[number];

export interface TopicPerson {
  id: string;
  code: string;
  name: string;
}

export interface TopicMember extends TopicPerson {
  // Mỗi nhóm có đúng một đại diện.
  representative: boolean;
}

export interface TopicSubmission {
  versionNo: number;
  kind: SubmissionKind;
  submittedBy: string;
  // yyyy-MM-ddTHH:mm:ss
  submittedAt: string;
  late: boolean;
  fileName: string;
}

export type RoleScores = Record<ScoreRole, number | null>;

export interface StudentScore {
  studentId: string;
  code: string;
  name: string;
  scores: RoleScores;
}

export interface TopicHistoryEntry {
  id: string;
  at: string;
  // Tên người thực hiện hoặc "Hệ thống".
  actor: string;
  category: HistoryCategory;
  action: string;
  detail?: string;
}

export interface Topic {
  id: string;
  roundId: string;
  code: string;
  title: string;
  description: string;
  requirements: string;
  field: string;
  supervisor: TopicPerson;
  source: TopicSource;
  status: TopicStatus;
  // Rỗng = chưa có nhóm; 1–2 sinh viên, đúng một đại diện.
  group: TopicMember[];
  reviewer: TopicPerson | null;
  council: string | null;
  // Phiên bản cũ trước, mới sau.
  submissions: TopicSubmission[];
  scores: StudentScore[];
  // Mới nhất trước.
  history: TopicHistoryEntry[];
}

export interface TopicFilters {
  roundId: string;
  supervisorId?: string;
  status?: TopicStatus | 'Tất cả';
  search?: string;
}

export type LoadLevel = 'below' | 'ok' | 'over';

export interface LecturerLoad {
  lecturerId: string;
  // Đề tài GV gửi + đề xuất SV đã chấp nhận.
  count: number;
  min: number;
  max: number;
  level: LoadLevel;
}

export interface TopicRoundState {
  roundId: string;
  roundName: string;
  roundStatus: RoundStatus;
  phase: TopicPhase;
  // Ngày kết thúc mốc "GV gửi đề tài" (yyyy-MM-dd); '' nếu chưa đặt.
  submissionDeadline: string;
  deadlinePassed: boolean;
  canPublish: boolean;
  // Lý do không công bố được (null khi canPublish).
  publishBlockedReason: string | null;
}

export interface TopicList {
  round: TopicRoundState;
  // Đã lọc, theo mã đề tài.
  items: Topic[];
  // Tổng đề tài của đợt (không lọc), để phân biệt "chưa có đề tài" với "lọc không có kết quả".
  roundTotal: number;
  loads: Record<string, LecturerLoad>;
}
