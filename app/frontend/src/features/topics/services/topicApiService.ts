import { ApiError, apiRequest } from '@/api/request';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  TopicNotFoundError,
  type ResultOutcome,
  type TopicService,
} from '@/features/topics/services/topicService';
import { filterTopics } from '@/features/topics/topicUtils';
import type { Round } from '@/types/round';
import type {
  LecturerLoad,
  LecturerLoadDto,
  LecturerTopicList,
  RoundTopicList,
  Topic,
  TopicDetailDto,
  TopicDto,
  TopicInput,
} from '@/types/topic';

function enc(value: string): string {
  return encodeURIComponent(value);
}

// Khai báo hàm (không phải const) vì topicService.ts và file này import nhau:
// topicService gọi createApiTopicService khi nạp module.
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Lỗi quy tắc của /api/topics (409) hoặc không có quyền (403); message lấy từ máy chủ.
export class TopicRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopicRuleError';
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 404) throw new TopicNotFoundError();
      if (err.status === 403 || err.status === 409)
        throw new TopicRuleError(err.message);
    }
    throw err;
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

// TopicDto có phần đề tài (P03-S01) và nhóm (P03-S02); phản biện, hội đồng, bài nộp
// và điểm chưa có API nên để trống (các màn hiển thị "chưa có").
export function toTopic(dto: TopicDto | TopicDetailDto): Topic {
  return {
    id: dto.id,
    roundId: dto.roundId,
    code: dto.code,
    title: dto.title,
    description: dto.description,
    requirements: dto.requirements ?? '',
    field: dto.field,
    supervisor: dto.supervisor,
    source: dto.source,
    status: dto.status,
    group: (dto.group ?? []).map((m) => ({ ...m })),
    reviewer: null,
    council: null,
    defense: null,
    outlineApprovedAt: null,
    finalLockedVersionNo: null,
    submissions: [],
    scores: [],
    history:
      'history' in dto
        ? dto.history.map((h) => ({
            id: h.id,
            at: h.at,
            actor: h.actor,
            category: h.category,
            action: h.action,
            detail: h.detail ?? undefined,
          }))
        : [],
  };
}

const toLoads = (loads: LecturerLoadDto[]): Record<string, LecturerLoad> =>
  Object.fromEntries(loads.map((l) => [l.lecturerId, { ...l }]));

const notYet = (ids: string[]): ResultOutcome[] =>
  ids.map((id) => ({
    topicId: id,
    code: id,
    title: '',
    ok: false,
    message: 'Bỏ qua: chức năng kết quả chưa có API.',
  }));

// TopicService của các màn Giáo vụ trên /api/topics. Xác nhận/công bố kết quả thuộc
// Phase 07 nên chưa có API; đề tài thật cũng chưa thể ở trạng thái chấm điểm.
export function createApiTopicService(
  rounds: RoundService = defaultRoundService,
): TopicService {
  return {
    today: localToday(),

    async roundState(roundId) {
      const round: Round = await rounds.get(roundId);
      return { roundId, roundName: round.name, roundStatus: round.status };
    },

    // GET /api/topics?roundId= → { round, items, loads }; lọc ở client như kho demo.
    async list(filters) {
      const data = await call<RoundTopicList>(
        `/topics?roundId=${enc(filters.roundId)}`,
      );
      const all = data.items.map(toTopic);
      return {
        round: {
          roundId: data.round.roundId,
          roundName: data.round.roundName,
          roundStatus: data.round.roundStatus,
        },
        items: filterTopics(all, filters),
        roundTotal: all.length,
        loads: toLoads(data.loads),
      };
    },

    // GET /api/topics/{id} → TopicDetailDto kèm lịch sử; 404 khi không có.
    async get(id) {
      return toTopic(await call<TopicDetailDto>(`/topics/${enc(id)}`));
    },

    async listSupervisors(roundId) {
      const round = await rounds.get(roundId);
      const people = await rounds.listParticipants('lecturer');
      return people
        .filter((p) => round.lecturerIds.includes(p.id))
        .map((p) => ({ id: p.id, code: p.code, name: p.name }));
    },

    confirmResults: async (ids) => notYet(ids),
    unconfirmResult: async (id) => notYet([id])[0],
    publishResults: async (ids) => notYet(ids),
    remindDeviations: async (ids) => notYet(ids),
  };
}

// --- Giảng viên: Đề tài của tôi ---

export interface LecturerTopicService {
  // Đợt GV tham gia (không gồm Nháp), mới nhất trước.
  listRounds(): Promise<Round[]>;
  listMine(roundId: string): Promise<LecturerTopicList>;
  // Vượt mức đề tài chỉ cảnh báo: màn hình đọc lại load sau khi lưu.
  create(roundId: string, input: TopicInput): Promise<TopicDto>;
  update(id: string, input: TopicInput): Promise<TopicDto>;
  remove(id: string): Promise<void>;
}

const topicBody = (input: TopicInput) => ({
  title: input.title,
  field: input.field,
  description: input.description,
  requirements: input.requirements.trim() || null,
});

export function createLecturerTopicService(): LecturerTopicService {
  return {
    listRounds: () => call<Round[]>('/rounds'),

    listMine: (roundId) =>
      call<LecturerTopicList>(`/topics/mine?roundId=${enc(roundId)}`),

    create: (roundId, input) =>
      call<TopicDto>('/topics', json('POST', { roundId, ...topicBody(input) })),

    update: (id, input) =>
      call<TopicDto>(`/topics/${enc(id)}`, json('PUT', topicBody(input))),

    async remove(id) {
      await call<boolean>(`/topics/${enc(id)}`, json('DELETE'));
    },
  };
}

export const lecturerTopicService: LecturerTopicService =
  createLecturerTopicService();

// --- Sinh viên: danh sách đề tài đã công bố ---

export interface StudentTopicService {
  listRounds(): Promise<Round[]>;
  // 409 (TopicRuleError) khi Giáo vụ chưa công bố danh sách.
  listPublished(roundId: string): Promise<RoundTopicList>;
}

export function createStudentTopicService(): StudentTopicService {
  return {
    listRounds: () => call<Round[]>('/rounds'),
    listPublished: (roundId) =>
      call<RoundTopicList>(`/topics/published?roundId=${enc(roundId)}`),
  };
}

export const studentTopicService: StudentTopicService =
  createStudentTopicService();
