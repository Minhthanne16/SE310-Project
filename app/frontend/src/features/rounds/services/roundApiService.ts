import { ApiError, apiRequest } from '@/api/request';
import {
  DuplicateRoundNameError,
  RoundNotFoundError,
  RoundRuleError,
  createRoundService,
  type AddParticipantsResult,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type {
  Candidate,
  Milestone,
  Participant,
  ParticipantCheck,
  ParticipantKind,
  Round,
  RoundFilters,
  RoundInput,
} from '@/types/round';

const KIND_PATH: Record<ParticipantKind, string> = {
  lecturer: 'lecturers',
  student: 'students',
};

const enc = encodeURIComponent;

const localToday = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Tính khi gọi (không ở mức module) vì roundService.ts và file này import nhau.
const duplicateMessage = () => new DuplicateRoundNameError().message;

// 404 → không tìm thấy đợt; 409 → vi phạm quy tắc (hoặc trùng tên khi tạo/sửa).
// Lỗi khác (400, 401, mạng...) giữ nguyên ApiError để nơi gọi hiển thị message.
function mapError(err: unknown, allowDuplicate = false): never {
  if (err instanceof ApiError) {
    if (err.status === 404) throw new RoundNotFoundError();
    if (err.status === 409) {
      if (allowDuplicate && err.message.includes(duplicateMessage()))
        throw new DuplicateRoundNameError();
      throw new RoundRuleError(err.message);
    }
  }
  throw err;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function call<T>(
  path: string,
  init?: RequestInit,
  allowDuplicate = false,
): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (err: unknown) {
    return mapError(err, allowDuplicate);
  }
}

// RoundService gọi backend thật (RoundsController, /api/rounds/*). Đang bật
// bằng NEXT_PUBLIC_ROUNDS_API=true; xem roundService.ts.
export function createApiRoundService(): RoundService {
  // Backend chưa có thông báo của đợt nên listNotifications chạy trên kho demo.
  const demo = createRoundService();
  const service: RoundService = {
    today: localToday(),

    list(filters: RoundFilters = {}) {
      const params: string[] = [];
      if (filters.status && filters.status !== 'Tất cả')
        params.push(`status=${enc(filters.status)}`);
      if (filters.program) params.push(`program=${enc(filters.program)}`);
      const search = filters.search?.trim();
      if (search) params.push(`search=${enc(search)}`);
      const query = params.join('&');
      return call<Round[]>(`/rounds${query ? `?${query}` : ''}`);
    },

    get: (id) => call<Round>(`/rounds/${enc(id)}`),

    create: (input: RoundInput) =>
      call<Round>('/rounds', json('POST', input), true),

    update: (id, input) =>
      call<Round>(
        `/rounds/${enc(id)}`,
        json('PUT', {
          name: input.name,
          program: input.program,
          periodLabel: input.periodLabel,
          lecturerLoadMin: input.lecturerLoadMin,
          lecturerLoadMax: input.lecturerLoadMax,
        }),
        true,
      ),

    open: (id) => call<Round>(`/rounds/${enc(id)}/open`, json('POST')),

    finish: (id) => call<Round>(`/rounds/${enc(id)}/finish`, json('POST')),

    async remove(id) {
      await call<boolean>(`/rounds/${enc(id)}`, json('DELETE'));
    },

    updateMilestones: (id, milestones: Milestone[]) =>
      call<Round>(`/rounds/${enc(id)}/milestones`, json('PUT', { milestones })),

    listParticipants: (kind) =>
      call<Participant[]>(`/rounds/people/${KIND_PATH[kind]}`),

    listCandidates: (id, kind) =>
      call<Candidate[]>(`/rounds/${enc(id)}/${KIND_PATH[kind]}/candidates`),

    checkParticipants: (id, kind, codes) =>
      call<ParticipantCheck[]>(
        `/rounds/${enc(id)}/${KIND_PATH[kind]}/check`,
        json('POST', { codes }),
      ),

    addParticipants: (id, kind, codes) =>
      call<AddParticipantsResult>(
        `/rounds/${enc(id)}/${KIND_PATH[kind]}`,
        json('POST', { codes }),
      ),

    removeParticipant: (id, kind, userId) =>
      call<Round>(
        `/rounds/${enc(id)}/${KIND_PATH[kind]}/${enc(userId)}`,
        json('DELETE'),
      ),

    listNotifications: (query) => demo.listNotifications(query),
    markTopicsPublished: (id) =>
      call<Round>(`/rounds/${enc(id)}/topics/publish`, json('POST')),
  };
  return service;
}
