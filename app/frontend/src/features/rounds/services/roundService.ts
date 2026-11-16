import type { RoundFieldErrors } from '@/features/rounds/roundValidation';
import { createApiRoundService } from '@/features/rounds/services/roundApiService';
import type {
  Candidate,
  Milestone,
  MilestoneErrors,
  NotificationPage,
  NotificationQuery,
  Participant,
  ParticipantCheck,
  ParticipantKind,
  Round,
  RoundFilters,
  RoundInput,
} from '@/types/round';

export class RoundNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy đợt.');
    this.name = 'RoundNotFoundError';
  }
}

// Trùng tên đợt (không phân biệt hoa thường, bỏ khoảng trắng đầu cuối).
export class DuplicateRoundNameError extends Error {
  constructor() {
    super('Tên đợt đã tồn tại. Đặt tên khác.');
    this.name = 'DuplicateRoundNameError';
  }
}

// Thiếu thông tin khi tạo đợt; fields cho form biết ô nào cần báo lỗi.
export class RoundValidationError extends Error {
  readonly fields: RoundFieldErrors;

  constructor(fields: RoundFieldErrors) {
    super('Thiếu thông tin đợt.');
    this.name = 'RoundValidationError';
    this.fields = fields;
  }
}

// Có mốc sai thứ tự; errors theo khóa mốc để hiện lỗi ngay tại dòng.
export class MilestoneOrderError extends Error {
  readonly errors: MilestoneErrors;

  constructor(errors: MilestoneErrors) {
    super('Có mốc sai thứ tự.');
    this.name = 'MilestoneOrderError';
    this.errors = errors;
  }
}

// Vi phạm quy tắc nghiệp vụ (sai trạng thái đợt, SV ở đợt khác, đã có dữ liệu...).
export class RoundRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoundRuleError';
  }
}

export interface AddParticipantsResult {
  round: Round;
  results: ParticipantCheck[];
  added: number;
}

// Hợp đồng chung của các màn đợt khóa luận của Giáo vụ. Component chỉ phụ
// thuộc interface này, nên khi backend có API chỉ cần thay phần cài đặt.
export interface RoundService {
  // "Hôm nay" (yyyy-MM-dd) dùng để suy ra trạng thái mốc, tuần hiện tại.
  readonly today: string;
  list(filters?: RoundFilters): Promise<Round[]>;
  get(id: string): Promise<Round>;
  create(input: RoundInput): Promise<Round>;
  // Sửa thông tin đợt (chương trình, tên đợt); chỉ khi đợt còn Nháp.
  update(id: string, input: RoundInput): Promise<Round>;
  open(id: string): Promise<Round>;
  finish(id: string): Promise<Round>;
  remove(id: string): Promise<void>;
  updateMilestones(id: string, milestones: Milestone[]): Promise<Round>;
  listParticipants(kind: ParticipantKind): Promise<Participant[]>;
  listCandidates(id: string, kind: ParticipantKind): Promise<Candidate[]>;
  checkParticipants(
    id: string,
    kind: ParticipantKind,
    codes: string[],
  ): Promise<ParticipantCheck[]>;
  addParticipants(
    id: string,
    kind: ParticipantKind,
    codes: string[],
  ): Promise<AddParticipantsResult>;
  removeParticipant(
    id: string,
    kind: ParticipantKind,
    userId: string,
  ): Promise<Round>;
  listNotifications(query: NotificationQuery): Promise<NotificationPage>;
  // Công bố danh sách đề tài của đợt cho sinh viên (tab Đề tài của chi tiết
  // đợt); không hoàn tác. Ném RoundRuleError khi đợt không Đang diễn ra, chưa
  // có đề tài, đã công bố hoặc đã hết hạn đăng ký (không phụ thuộc hạn GV gửi).
  markTopicsPublished(id: string): Promise<Round>;
}

// Ứng dụng luôn dùng API thật (roundApiService.ts). Kho trong bộ nhớ dành cho
// test nằm ở roundDemoService.ts và được truyền vào component qua prop.
export const roundService: RoundService = createApiRoundService();
