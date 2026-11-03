// Đợt khóa luận (docs/DESIGN/03: Danh sách đợt, Chi tiết đợt, Gantt). Mặc định
// chạy trên kho demo (features/rounds/services/roundService.ts); đặt
// NEXT_PUBLIC_ROUNDS_API=true để dùng API thật (roundApiService.ts).

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
  // Trạng thái chấm điểm suy ra từ phiếu điểm của cả nhóm (PDR-049).
  'Đang cho điểm',
  'Đã cho điểm',
  'Có lệch điểm',
  // Giáo vụ đã xác nhận kết quả cả nhóm, chưa công bố; chưa tính là kết thúc.
  'Đã xác nhận',
  'Đã hoàn tất',
  // Trạng thái kết thúc (PDR-011): Giáo vụ kết thúc đề tài mà nhóm không nộp
  // khóa luận. Đề tài đã công bố nhưng không có nhóm khi đăng ký tự đóng chuyển
  // sang "Không có nhóm".
  'Không đủ điều kiện công bố',
  'Không có nhóm',
] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

// Đề tài ở các trạng thái này không còn chờ công bố kết quả, nên không chặn
// kết thúc đợt (PDR-031). "Bị từ chối" là đề xuất sinh viên không được nhận.
export const SETTLED_TOPIC_STATUSES: readonly TopicStatus[] = [
  'Đã hoàn tất',
  'Không đủ điều kiện công bố',
  'Không có nhóm',
  'Bị từ chối',
];

export const isSettledTopicStatus = (status: TopicStatus): boolean =>
  SETTLED_TOPIC_STATUSES.includes(status);

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

export const ACCOUNT_STATUSES = [
  'Đang hoạt động',
  'Chưa đăng nhập',
  'Vô hiệu hóa',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface Participant {
  id: string;
  code: string;
  name: string;
  // Lớp (sinh viên) hoặc bộ môn (giảng viên).
  unit: string;
  email: string;
  accountStatus: AccountStatus;
}

export interface TopicSummary {
  total: number;
  // Số đề tài chưa ở trạng thái kết thúc (isSettledTopicStatus): còn chờ công
  // bố kết quả. Chặn kết thúc đợt khi > 0 (PDR-031).
  pendingResultCount: number;
  byStatus: Record<TopicStatus, number>;
}

export interface Round {
  id: string;
  name: string;
  program: RoundProgram;
  // Học kỳ hoặc khóa, ví dụ "HK1 2026–2027", "Đợt 1/2026".
  periodLabel: string;
  status: RoundStatus;
  // Số đề tài mỗi giảng viên nhận hướng dẫn, chỉ để cảnh báo. 0 = chưa đặt mức.
  lecturerLoadMin: number;
  lecturerLoadMax: number;
  // Thời điểm công bố danh sách đề tài cho sinh viên (ISO 8601); null = chưa
  // công bố. Công bố không hoàn tác được.
  topicsPublishedAt: string | null;
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
  // Sao chép khung 9 mốc (Thông báo cho, Cho nộp trễ) từ đợt cũ; không sao chép
  // ngày, giảng viên hay sinh viên (PDR-034).
  copyFromId?: string;
  // Chỉ dùng khi sửa đợt Nháp; bỏ trống thì giữ mức hiện có.
  lecturerLoadMin?: number;
  lecturerLoadMax?: number;
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

// Các tab có thể là đích của một việc cần làm ở Trang chủ.
export type RoundTaskTab =
  'tien-do' | 'cau-hinh' | 'giang-vien' | 'sinh-vien' | 'de-tai';

// Sáu tab của chi tiết đợt (artboard GiaoVu-DotKhoaLuan): thêm Đề tài và
// Đánh giá để giáo vụ xem đề tài và tóm tắt phiếu/phản biện/hội đồng của đợt.
export type RoundTab = RoundTaskTab | 'danh-gia';

// Giai đoạn của đợt Đang diễn ra, suy ra từ ngày và việc công bố danh sách.
export const ROUND_STAGES = [
  'GV gửi đề tài',
  'Chờ công bố danh sách',
  'SV đăng ký',
  'Thực hiện',
  'Sẵn sàng kết thúc',
] as const;
export type RoundStage = (typeof ROUND_STAGES)[number];

export interface RoundTask {
  id: string;
  text: string;
  // Tab của chi tiết đợt để xử lý việc này.
  tab: RoundTaskTab;
}
