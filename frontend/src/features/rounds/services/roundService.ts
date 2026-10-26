import {
  nameKey,
  normalizeRoundInput,
  validateRoundInput,
  type RoundFieldErrors,
} from '@/features/rounds/roundValidation';
import { validateMilestones } from '@/features/rounds/roundUtils';
import {
  DEMO_TODAY,
  buildMilestones,
  seedNotifications,
  seedParticipants,
  seedRounds,
} from '@/features/rounds/services/roundSeed';
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
import { TOPIC_STATUSES } from '@/types/round';

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
}

const cloneRound = (round: Round): Round => ({
  ...round,
  milestones: round.milestones.map((m) => ({ ...m })),
  lecturerIds: [...round.lecturerIds],
  studentIds: [...round.studentIds],
  topicSummary: {
    ...round.topicSummary,
    byStatus: { ...round.topicSummary.byStatus },
  },
});

const idsOf = (round: Round, kind: ParticipantKind) =>
  kind === 'student' ? round.studentIds : round.lecturerIds;

const KIND_LABEL: Record<ParticipantKind, string> = {
  lecturer: 'giảng viên',
  student: 'sinh viên',
};

const emptyTopics = (): Round['topicSummary'] => ({
  total: 0,
  unpublishedCount: 0,
  byStatus: Object.fromEntries(
    TOPIC_STATUSES.map((s) => [s, 0]),
  ) as Round['topicSummary']['byStatus'],
});

interface RoundServiceOptions {
  today?: string;
}

// DEMO: backend chưa có API đợt, mốc, người tham gia, đề tài hay thông báo
// (docs/DESIGN/03). Toàn bộ chạy trên kho trong bộ nhớ dưới đây; dữ liệu mất
// khi tải lại trang. Endpoint đề xuất cho từng hàm nằm ở chú thích; khi backend
// có, thay thân hàm bằng apiRequest tương ứng và giữ nguyên interface.
export function createRoundService(
  options: RoundServiceOptions = {},
): RoundService {
  const today = options.today ?? DEMO_TODAY;
  const users = seedParticipants();
  let rounds = seedRounds();
  const notifications = seedNotifications();
  let nextId = rounds.length + 1;

  const find = (id: string): Round => {
    const round = rounds.find((r) => r.id === id);
    if (!round) throw new RoundNotFoundError();
    return round;
  };

  const save = (next: Round): Round => {
    rounds = rounds.map((r) => (r.id === next.id ? next : r));
    return cloneRound(next);
  };

  // Một sinh viên chỉ thuộc một đợt đang diễn ra.
  const runningRoundOf = (studentId: string, exceptId: string) =>
    rounds.find(
      (r) =>
        r.id !== exceptId &&
        r.status === 'Đang diễn ra' &&
        r.studentIds.includes(studentId),
    );

  const check = (
    round: Round,
    kind: ParticipantKind,
    codes: string[],
  ): ParticipantCheck[] => {
    const seen = new Set<string>();
    const results: ParticipantCheck[] = [];
    for (const raw of codes) {
      const code = raw.trim();
      if (!code || seen.has(code.toLowerCase())) continue;
      seen.add(code.toLowerCase());
      const participant = users[kind].find(
        (u) => u.code.toLowerCase() === code.toLowerCase(),
      );
      if (!participant) {
        results.push({
          code,
          status: 'notFound',
          message: `Không tồn tại ${KIND_LABEL[kind]} có mã này.`,
        });
      } else if (idsOf(round, kind).includes(participant.id)) {
        results.push({
          code,
          status: 'alreadyInRound',
          message: 'Đã có trong đợt này.',
          participant,
        });
      } else {
        const other =
          kind === 'student'
            ? runningRoundOf(participant.id, round.id)
            : undefined;
        results.push(
          other
            ? {
                code,
                status: 'inOtherRound',
                message: `Đang thuộc đợt “${other.name}”. Một sinh viên chỉ ở một đợt đang diễn ra.`,
                participant,
              }
            : {
                code,
                status: 'valid',
                message: 'Hợp lệ.',
                participant,
              },
        );
      }
    }
    return results;
  };

  const assertEditable = (round: Round) => {
    if (round.status === 'Đã kết thúc')
      throw new RoundRuleError('Đợt đã kết thúc nên không sửa được nữa.');
  };

  return {
    today,

    // Đề xuất: GET /api/rounds?status=&program=&search= → ApiResponse<RoundDto[]>
    // (phân trang phía máy chủ khi dữ liệu lớn). Giáo vụ thấy cả đợt Nháp.
    async list(filters = {}) {
      const keyword = nameKey(filters.search ?? '');
      return rounds
        .filter(
          (r) =>
            (!filters.status ||
              filters.status === 'Tất cả' ||
              r.status === filters.status) &&
            (!filters.program || r.program === filters.program) &&
            (!keyword || nameKey(r.name).includes(keyword)),
        )
        .map(cloneRound);
    },

    // Đề xuất: GET /api/rounds/{id} → RoundDto; 404 khi không có.
    async get(id) {
      return cloneRound(find(id));
    },

    // Đề xuất: POST /api/rounds { name, program, periodLabel, copyFromId? }
    // → 201 RoundDto (trạng thái Nháp); 400 thiếu thông tin; 409 trùng tên đợt.
    // Sao chép từ đợt cũ: giữ cấu hình mốc ("Thông báo cho", "Cho nộp trễ") và
    // danh sách giảng viên; xóa ngày (ngày của đợt cũ đã qua nên dễ gây lệch
    // thứ tự) và không sao chép sinh viên.
    async create(raw) {
      const fields = validateRoundInput(raw);
      if (Object.keys(fields).length > 0)
        throw new RoundValidationError(fields);
      const input = normalizeRoundInput(raw);
      if (rounds.some((r) => nameKey(r.name) === nameKey(input.name)))
        throw new DuplicateRoundNameError();

      const source = input.copyFromId ? find(input.copyFromId) : undefined;
      const blank = buildMilestones([]);
      const round: Round = {
        id: `r-${nextId++}`,
        name: input.name,
        program: input.program as Round['program'],
        periodLabel: input.periodLabel,
        status: 'Nháp',
        milestones: source
          ? blank.map((m) => {
              const old = source.milestones.find((o) => o.key === m.key);
              return old
                ? {
                    ...m,
                    notifyAudience: old.notifyAudience,
                    allowLate: m.allowLate === null ? null : old.allowLate,
                  }
                : m;
            })
          : blank,
        lecturerIds: source ? [...source.lecturerIds] : [],
        studentIds: [],
        topicSummary: emptyTopics(),
      };
      rounds = [round, ...rounds];
      return cloneRound(round);
    },

    // Đề xuất: POST /api/rounds/{id}/open → RoundDto; 409 khi không phải Nháp
    // hoặc có sinh viên đang ở đợt đang diễn ra khác. Việc chưa xong (thiếu ngày,
    // chưa có người) chỉ cảnh báo ở giao diện, không chặn. Máy chủ gửi thông
    // báo cho giảng viên và sinh viên của đợt.
    async open(id) {
      const round = find(id);
      if (round.status !== 'Nháp')
        throw new RoundRuleError('Chỉ mở được đợt Nháp.');
      const conflicts = round.studentIds.filter((s) =>
        runningRoundOf(s, round.id),
      );
      if (conflicts.length > 0)
        throw new RoundRuleError(
          `Không mở được đợt: sinh viên ${conflicts.join(', ')} đang thuộc đợt đang diễn ra khác.`,
        );
      return save({ ...round, status: 'Đang diễn ra' });
    },

    // Đề xuất: POST /api/rounds/{id}/finish → RoundDto; 409 khi không phải
    // Đang diễn ra. Còn đề tài chưa công bố chỉ cảnh báo ở giao diện.
    async finish(id) {
      const round = find(id);
      if (round.status !== 'Đang diễn ra')
        throw new RoundRuleError('Chỉ kết thúc được đợt đang diễn ra.');
      return save({ ...round, status: 'Đã kết thúc' });
    },

    // Đề xuất: DELETE /api/rounds/{id} → 204; 409 khi không phải Nháp.
    async remove(id) {
      const round = find(id);
      if (round.status !== 'Nháp')
        throw new RoundRuleError('Chỉ xóa được đợt Nháp.');
      rounds = rounds.filter((r) => r.id !== id);
    },

    // Đề xuất: PUT /api/rounds/{id}/milestones { milestones: MilestoneDto[9] }
    // → RoundDto; 400 kèm lỗi theo mốc khi sai thứ tự.
    async updateMilestones(id, milestones) {
      const round = find(id);
      assertEditable(round);
      const errors = validateMilestones(milestones);
      if (Object.keys(errors).length > 0) throw new MilestoneOrderError(errors);
      return save({
        ...round,
        // Giữ tên và thứ tự 9 mốc cố định; chỉ nhận phần cấu hình.
        milestones: round.milestones.map((m) => {
          const next = milestones.find((x) => x.key === m.key);
          return next
            ? {
                ...m,
                startDate: next.startDate.trim(),
                endDate: next.endDate.trim(),
                notifyAudience: next.notifyAudience,
                allowLate: m.allowLate === null ? null : !!next.allowLate,
              }
            : m;
        }),
      });
    },

    // Đề xuất: GET /api/users?role=Lecturer|Student (đã có thể dùng chung với
    // màn Người dùng khi backend có endpoint danh sách).
    async listParticipants(kind) {
      return users[kind].map((u) => ({ ...u }));
    },

    // Đề xuất: GET /api/rounds/{id}/lecturers|students/candidates → người chưa
    // thuộc đợt, kèm lý do không chọn được.
    async listCandidates(id, kind) {
      const round = find(id);
      const inRound = new Set(idsOf(round, kind));
      return users[kind]
        .filter((u) => !inRound.has(u.id))
        .map((u) => {
          const other =
            kind === 'student' ? runningRoundOf(u.id, round.id) : undefined;
          return other
            ? { ...u, blockedReason: `Đang ở đợt “${other.name}”` }
            : { ...u };
        });
    },

    // Đề xuất: POST /api/rounds/{id}/lecturers|students/check { codes }
    // → kết quả từng mã (không ghi).
    async checkParticipants(id, kind, codes) {
      const round = find(id);
      assertEditable(round);
      return check(round, kind, codes);
    },

    // Đề xuất: POST /api/rounds/{id}/lecturers|students { codes }
    // → { results, added }. Chỉ thêm mã hợp lệ; mã còn lại trả lý do.
    async addParticipants(id, kind, codes) {
      const round = find(id);
      assertEditable(round);
      const results = check(round, kind, codes);
      const valid = results.filter(
        (r) => r.status === 'valid' && r.participant,
      );
      const next = cloneRound(round);
      for (const r of valid) idsOf(next, kind).push(r.participant!.id);
      return { round: save(next), results, added: valid.length };
    },

    // Đề xuất: DELETE /api/rounds/{id}/lecturers|students/{userId} → RoundDto;
    // 409 khi người đó đã có dữ liệu (đề tài, điểm...); không có trạng thái
    // "Ngừng tham gia".
    async removeParticipant(id, kind, userId) {
      const round = find(id);
      assertEditable(round);
      const participant = users[kind].find((u) => u.id === userId);
      if (!participant || !idsOf(round, kind).includes(userId))
        throw new RoundRuleError(`Không có ${KIND_LABEL[kind]} này trong đợt.`);
      if (participant.hasData)
        throw new RoundRuleError(
          `Không gỡ được ${participant.name}: đã có dữ liệu (đề tài, điểm...) trong đợt.`,
        );
      const next = cloneRound(round);
      if (kind === 'student')
        next.studentIds = next.studentIds.filter((x) => x !== userId);
      else next.lecturerIds = next.lecturerIds.filter((x) => x !== userId);
      return save(next);
    },

    // Đề xuất: GET /api/notifications?roundId=&source=all|giaovu|mine&search=&limit=
    // → { items, total }, mới nhất trước. Bảng thông báo không có trả lời và
    // không có số người đã xem.
    async listNotifications(query) {
      const keyword = nameKey(query.search ?? '');
      const items = notifications
        .filter(
          (n) =>
            n.roundId === query.roundId &&
            (!query.source ||
              query.source === 'all' ||
              (query.source === 'giaovu' && n.source === 'Từ giáo vụ') ||
              (query.source === 'mine' && n.mine)) &&
            (!keyword ||
              nameKey(n.title).includes(keyword) ||
              nameKey(n.sender).includes(keyword)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        items: items
          .slice(0, query.limit ?? items.length)
          .map((n) => ({ ...n })),
        total: items.length,
      };
    },
  };
}

export const roundService: RoundService = createRoundService();
