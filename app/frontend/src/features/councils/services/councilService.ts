import { ApiError, apiRequest } from '@/api/request';
import type {
  Council,
  CouncilBoard,
  CouncilCheckResult,
  CouncilInput,
  CouncilPublishResult,
  MyCouncils,
} from '@/types/council';

// Quy tắc lịch bị từ chối (409): xung đột phòng/giảng viên/đề tài, đã có điểm, hội đồng vừa đổi.
// Danh sách xung đột từng dòng lấy bằng check(); message ở đây đã gộp các dòng.
export class CouncilConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CouncilConflictError';
  }
}

// Hợp đồng của màn Hội đồng bảo vệ; component chỉ phụ thuộc interface này.
export interface CouncilService {
  board(roundId: string): Promise<CouncilBoard>;
  // Xem trước xung đột của bản đang sửa; không lưu.
  check(
    input: CouncilInput,
    councilId: string | null,
  ): Promise<CouncilCheckResult>;
  create(input: CouncilInput): Promise<Council>;
  update(councilId: string, input: CouncilInput): Promise<Council>;
  remove(councilId: string): Promise<void>;
  // Không truyền councilIds: công bố mọi hội đồng Nháp của đợt.
  publish(
    roundId: string,
    councilIds?: string[],
  ): Promise<CouncilPublishResult>;
  cancel(councilId: string, reason: string): Promise<Council>;
  correct(councilId: string, content: string, reason: string): Promise<Council>;
  mine(roundId?: string): Promise<MyCouncils>;
}

const BASE = '/councils';
const enc = encodeURIComponent;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409)
      throw new CouncilConflictError(err.message);
    throw err;
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function createCouncilService(): CouncilService {
  return {
    board: (roundId) => call<CouncilBoard>(`${BASE}?roundId=${enc(roundId)}`),
    check: (input, councilId) =>
      call<CouncilCheckResult>(
        `${BASE}/check`,
        json('POST', { ...input, councilId }),
      ),
    create: (input) => call<Council>(BASE, json('POST', input)),
    update: (councilId, input) =>
      call<Council>(`${BASE}/${enc(councilId)}`, json('PUT', input)),
    async remove(councilId) {
      await call<boolean>(`${BASE}/${enc(councilId)}`, json('DELETE'));
    },
    publish: (roundId, councilIds) =>
      call<CouncilPublishResult>(
        `${BASE}/publish`,
        json('POST', { roundId, councilIds: councilIds ?? null }),
      ),
    cancel: (councilId, reason) =>
      call<Council>(
        `${BASE}/${enc(councilId)}/cancel`,
        json('POST', { reason }),
      ),
    correct: (councilId, content, reason) =>
      call<Council>(
        `${BASE}/${enc(councilId)}/corrections`,
        json('POST', { content, reason }),
      ),
    mine: (roundId) =>
      call<MyCouncils>(
        roundId ? `${BASE}/mine?roundId=${enc(roundId)}` : `${BASE}/mine`,
      ),
  };
}

export const councilService: CouncilService = createCouncilService();
