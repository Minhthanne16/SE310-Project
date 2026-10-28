// Đợt khóa luận (docs/DESIGN/03: Danh sách đợt, Chi tiết đợt, Gantt). Backend
// chưa có API đợt/đề tài/thông báo nên các kiểu dưới đây do frontend đề xuất
// và chạy trên kho demo (features/rounds/services/roundService.ts).

export const ROUND_PROGRAMS = ['Văn bằng 1', 'Văn bằng 2', 'Thạc sĩ'] as const;
export type RoundProgram = (typeof ROUND_PROGRAMS)[number];

export const ROUND_STATUSES = ['Nháp', 'Đang diễn ra', 'Đã kết thúc'] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const TOPIC_STATUSES = [
  'Chưa đăng ký',
  'Chờ GV duyệt',
  'Đã đăng ký',
  'Bị từ chối',
  'Đang thực hiện',
  'Đã cho điểm',
  'Đã hoàn tất',
] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export type MilestoneKey =
  | 'topicSubmission'
  | 'topicRegistration'
  | 'outline'
  | 'midterm'
  | 'final'
  | 'reviewSchedule'
  | 'defenseSchedule'
  | 'grading'
  | 'finalize';

export const NOTIFY_AUDIENCES = ['Sinh viên', 'Giảng viên', 'Tất cả'] as const;
export type NotifyAudience = (typeof NOTIFY_AUDIENCES)[number];

// 9 mốc theo thứ tự trong 03-dac-ta-man-hinh.md. Dấu "·" nối các phần của MỘT
// mốc. Chỉ ba mốc báo cáo có công tắc "Cho nộp trễ".
export const MILESTONE_DEFS: {
  key: MilestoneKey;
  name: string;
  hasLateToggle: boolean;
}[] = [
  { key: 'topicSubmission', name: 'GV gửi đề tài', hasLateToggle: false },
  {
    key: 'topicRegistration',
    name: 'Công bố đề tài · SV đăng ký',
    hasLateToggle: false,
  },
  { key: 'outline', name: 'Đề cương', hasLateToggle: true },
  { key: 'midterm', name: 'Báo cáo giữa kỳ', hasLateToggle: true },
  { key: 'final', name: 'Báo cáo cuối kỳ', hasLateToggle: true },
  { key: 'reviewSchedule', name: 'Lịch phản biện', hasLateToggle: false },
  { key: 'defenseSchedule', name: 'Lịch bảo vệ', hasLateToggle: false },
  // Chỉ để nhắc, không khóa phiếu chấm.
  { key: 'grading', name: 'Thời gian cho điểm', hasLateToggle: false },
  {
    key: 'finalize',
    name: 'Chốt bản cuối · công bố',
    hasLateToggle: false,
  },
];

export type MilestoneStatus = 'Đã qua' | 'Đang diễn ra' | 'Sắp tới';

export interface Milestone {
  key: MilestoneKey;
  name: string;
  // yyyy-MM-dd; chuỗi rỗng nghĩa là chưa đặt ngày.
  startDate: string;
  endDate: string;
  notifyAudience: NotifyAudience;
  // Chỉ có ý nghĩa với Đề cương, Giữa kỳ, Cuối kỳ (mặc định true, theo
  // period_milestones.allow_late); null với các mốc còn lại. Chỉ là công tắc:
  // thời hạn nộp trễ chưa quy định (OQ-006).
  allowLate: boolean | null;
}

export type MilestoneErrors = Partial<Record<MilestoneKey, string>>;

export type ParticipantKind = 'lecturer' | 'student';

export interface Participant {
  id: string;
  code: string;
  name: string;
  // Lớp (sinh viên) hoặc bộ môn (giảng viên).
  unit: string;
}

export interface TopicSummary {
  total: number;
  unpublishedCount: number;
  byStatus: Record<TopicStatus, number>;
}

export interface Round {
  id: string;
  name: string;
  program: RoundProgram;
  // Học kỳ hoặc khóa, ví dụ "HK1 2026–2027", "Đợt 1/2026".
  periodLabel: string;
  status: RoundStatus;
  milestones: Milestone[];
  lecturerIds: string[];
  studentIds: string[];
  // Sinh viên đã có dữ liệu TRONG ĐỢT NÀY (đề tài, điểm...): không gỡ được khỏi
  // đợt (03: Chi tiết đợt). Theo từng đợt, không theo từng người; giảng viên
  // không bị khóa (tài liệu chỉ nêu quy tắc này cho sinh viên).
  lockedStudentIds: string[];
  topicSummary: TopicSummary;
}

export interface RoundInput {
  name: string;
  program: RoundProgram | '';
  periodLabel: string;
  // Sao chép cấu hình mốc và danh sách giảng viên từ đợt cũ (không sao chép
  // sinh viên và không sao chép ngày).
  copyFromId?: string;
}

export interface RoundFilters {
  status?: RoundStatus | 'Tất cả';
  program?: RoundProgram | '';
  search?: string;
}

export type ParticipantCheckStatus =
  'valid' | 'notFound' | 'alreadyInRound' | 'inOtherRound';

export interface ParticipantCheck {
  code: string;
  status: ParticipantCheckStatus;
  message: string;
  participant?: Participant;
}

export type Candidate = Participant & {
  // Có giá trị = không chọn được (ví dụ sinh viên đang ở đợt khác).
  blockedReason?: string;
};

export type NoticeSource = 'Từ giáo vụ' | 'Từ giảng viên';
export type NoticeFilter = 'all' | 'giaovu' | 'mine';

export interface RoundNotification {
  id: string;
  roundId: string;
  title: string;
  sender: string;
  source: NoticeSource;
  // Do người dùng hiện tại gửi (máy chủ quyết định theo phiên đăng nhập).
  mine: boolean;
  createdAt: string;
  body: string;
}

export interface NotificationQuery {
  roundId: string;
  source?: NoticeFilter;
  search?: string;
  limit?: number;
}

export interface NotificationPage {
  items: RoundNotification[];
  total: number;
}

export type RoundTab = 'tien-do' | 'cau-hinh' | 'giang-vien' | 'sinh-vien';

export interface RoundTask {
  id: string;
  text: string;
  // Tab của chi tiết đợt để xử lý việc này.
  tab: RoundTab;
}
