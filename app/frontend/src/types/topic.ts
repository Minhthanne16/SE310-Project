// Đề tài khóa luận (docs/DESIGN/03: Quản lý đề tài, Chi tiết đề tài của giáo
// vụ, Đề tài của tôi). API thật /api/topics (PDR-053) trả TopicDto, được chuyển
// sang Topic ở topicApiService.ts; kho demo dùng thẳng Topic.
import type { RoundStatus, TopicStatus } from '@/types/round';

export { TOPIC_STATUSES, type TopicStatus } from '@/types/round';

export const TOPIC_SOURCES = ['GV công bố', 'SV đề xuất'] as const;
export type TopicSource = (typeof TOPIC_SOURCES)[number];

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
  // Sửa tên, lĩnh vực, mô tả, yêu cầu của đề tài (PDR-053).
  'Nội dung',
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
  // Lớp, ví dụ "KTPM2022.1".
  className: string;
}

export interface TopicSubmission {
  versionNo: number;
  kind: SubmissionKind;
  submittedBy: string;
  // yyyy-MM-ddTHH:mm:ss
  submittedAt: string;
  late: boolean;
  fileName: string;
  // Ghi chú thay đổi của phiên bản (03: bắt buộc khi nộp).
  note: string;
}

// Hội đồng và lịch bảo vệ của một đề tài.
export interface TopicDefense {
  council: string;
  councilPublished: boolean;
  chair: string;
  secretary: string;
  // yyyy-MM-ddTHH:mm:ss
  start: string;
  room: string;
  // Thứ tự bảo vệ trong buổi.
  order: number;
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
  // Chủ tịch, thư ký và lịch bảo vệ; null khi chưa xếp lịch.
  defense: TopicDefense | null;
  // Thời điểm duyệt đề cương (yyyy-MM-ddTHH:mm:ss); null khi chưa duyệt.
  outlineApprovedAt: string | null;
  // versionNo của bản Cuối kỳ đã chốt; null khi chưa chốt bản cuối.
  finalLockedVersionNo: number | null;
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

// Tên và trạng thái của đợt chứa đề tài (breadcrumb, tiêu đề). Việc công bố
// danh sách đề tài nằm ở Round.topicsPublishedAt (roundService).
export interface TopicRoundState {
  roundId: string;
  roundName: string;
  roundStatus: RoundStatus;
}

export interface TopicList {
  round: TopicRoundState;
  // Đã lọc, theo mã đề tài.
  items: Topic[];
  // Tổng đề tài của đợt (không lọc), để phân biệt "chưa có đề tài" với "lọc không có kết quả".
  roundTotal: number;
  loads: Record<string, LecturerLoad>;
}

// --- Hợp đồng /api/topics (PDR-053) ---

// all: sửa mọi trường; content: chỉ mô tả và yêu cầu (sau công bố); none.
export type TopicEditScope = 'all' | 'content' | 'none';

export interface TopicDto {
  id: string;
  roundId: string;
  code: string;
  title: string;
  field: string;
  description: string;
  requirements: string | null;
  supervisor: TopicPerson;
  source: TopicSource;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string | null;
  canEdit: TopicEditScope;
  canDelete: boolean;
  // Nhóm đang nhận đề tài, đại diện trước (PDR-054); rỗng khi chưa có nhóm.
  group: TopicMember[];
}

export interface TopicHistoryDto {
  id: string;
  at: string;
  actor: string;
  category: HistoryCategory;
  action: string;
  detail: string | null;
}

export interface TopicDetailDto extends TopicDto {
  history: TopicHistoryDto[];
}

export interface TopicRoundInfo {
  roundId: string;
  roundName: string;
  roundStatus: RoundStatus;
  topicsPublishedAt: string | null;
  // yyyy-MM-dd hoặc rỗng.
  submissionStart: string;
  submissionEnd: string;
  registrationEnd: string;
  canSubmit: boolean;
  submitBlockedReason: string | null;
}

export interface LecturerLoadDto {
  lecturerId: string;
  count: number;
  min: number;
  max: number;
  level: LoadLevel;
}

export interface LecturerTopicList {
  round: TopicRoundInfo;
  items: TopicDto[];
  load: LecturerLoadDto;
}

export interface RoundTopicList {
  round: TopicRoundInfo;
  items: TopicDto[];
  loads: LecturerLoadDto[];
}

export interface TopicInput {
  title: string;
  field: string;
  description: string;
  requirements: string;
}
