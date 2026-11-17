import { ApiError, apiRequest } from '@/api/request';
import type {
  AssignReviewerResult,
  MyReviews,
  ReviewerAssignments,
  ReviewerBatchItem,
  ReviewerBatchResult,
  ReviewerSuggestion,
} from '@/types/reviewer';

// Quy tắc phân công bị từ chối (409): chưa đủ điều kiện, GVHD, đã khóa hoặc phân công vừa thay đổi.
export class ReviewerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewerConflictError';
  }
}

// Hợp đồng của màn Phân công phản biện; component chỉ phụ thuộc interface này.
export interface ReviewerService {
  list(roundId: string): Promise<ReviewerAssignments>;
  // Chỉ gợi ý để điền sẵn; không lưu.
  suggest(roundId: string): Promise<ReviewerSuggestion[]>;
  assign(
    topicId: string,
    reviewerId: string,
    expectedReviewerId: string | null,
  ): Promise<AssignReviewerResult>;
  // Trả kết quả từng dòng; dòng lỗi không làm hỏng dòng hợp lệ.
  batch(
    roundId: string,
    items: ReviewerBatchItem[],
  ): Promise<ReviewerBatchResult>;
  mine(roundId?: string): Promise<MyReviews>;
}

const BASE = '/reviewer-assignments';
const enc = encodeURIComponent;

export function createReviewerService(): ReviewerService {
  return {
    list: (roundId) =>
      apiRequest<ReviewerAssignments>(`${BASE}?roundId=${enc(roundId)}`),

    suggest: (roundId) =>
      apiRequest<ReviewerSuggestion[]>(
        `${BASE}/suggestions?roundId=${enc(roundId)}`,
      ),

    async assign(topicId, reviewerId, expectedReviewerId) {
      try {
        return await apiRequest<AssignReviewerResult>(
          `${BASE}/${enc(topicId)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ reviewerId, expectedReviewerId }),
          },
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 409)
          throw new ReviewerConflictError(err.message);
        throw err;
      }
    },

    batch: (roundId, items) =>
      apiRequest<ReviewerBatchResult>(`${BASE}/batch`, {
        method: 'POST',
        body: JSON.stringify({ roundId, items }),
      }),

    mine: (roundId) =>
      apiRequest<MyReviews>(
        roundId ? `${BASE}/mine?roundId=${enc(roundId)}` : `${BASE}/mine`,
      ),
  };
}

export const reviewerService: ReviewerService = createReviewerService();
