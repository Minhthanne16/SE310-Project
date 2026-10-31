import { ApiError, apiRequest } from '@/api/request';
import type {
  EvaluationTemplate,
  GradingRole,
  TemplateAssignment,
  TemplateInput,
  TemplateStatus,
} from '@/types/evaluation';

// Trùng tên mẫu (backend trả 409 khi tạo/sửa).
export class DuplicateTemplateNameError extends Error {
  constructor(message = 'Tên mẫu phiếu đã tồn tại. Đặt tên khác.') {
    super(message);
    this.name = 'DuplicateTemplateNameError';
  }
}

// Mẫu đang được gán cho đợt nên không xóa được (backend trả 409 khi xóa).
export class TemplateInUseError extends Error {
  constructor(
    message = 'Mẫu phiếu đang được gán cho đợt khóa luận. Gỡ gán trước khi xóa.',
  ) {
    super(message);
    this.name = 'TemplateInUseError';
  }
}

// Hợp đồng của màn Mẫu phiếu đánh giá; component chỉ phụ thuộc interface này.
export interface EvaluationService {
  list(): Promise<EvaluationTemplate[]>;
  create(input: TemplateInput): Promise<EvaluationTemplate>;
  update(id: string, input: TemplateInput): Promise<EvaluationTemplate>;
  setStatus(id: string, status: TemplateStatus): Promise<EvaluationTemplate>;
  // removeAssignments: Giáo vụ đã xác nhận gỡ mọi lần gán của mẫu rồi xóa.
  remove(id: string, options?: { removeAssignments?: boolean }): Promise<void>;
  listAssignments(roundId: string): Promise<TemplateAssignment[]>;
  // Mọi lần gán của mọi đợt, cho danh sách đợt.
  listAllAssignments(): Promise<TemplateAssignment[]>;
  assign(
    roundId: string,
    role: GradingRole,
    templateId: string,
  ): Promise<TemplateAssignment>;
  unassign(roundId: string, role: GradingRole): Promise<void>;
}

const BASE = '/evaluation-templates';
const json = (body: unknown) => JSON.stringify(body);
const seg = encodeURIComponent;

const isConflict = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 409;

export function createEvaluationService(): EvaluationService {
  return {
    list: () => apiRequest<EvaluationTemplate[]>(BASE),

    async create(input) {
      try {
        return await apiRequest<EvaluationTemplate>(BASE, {
          method: 'POST',
          body: json(input),
        });
      } catch (err) {
        if (isConflict(err)) throw new DuplicateTemplateNameError(err.message);
        throw err;
      }
    },

    async update(id, input) {
      try {
        return await apiRequest<EvaluationTemplate>(`${BASE}/${seg(id)}`, {
          method: 'PUT',
          body: json(input),
        });
      } catch (err) {
        if (isConflict(err)) throw new DuplicateTemplateNameError(err.message);
        throw err;
      }
    },

    setStatus: (id, status) =>
      apiRequest<EvaluationTemplate>(`${BASE}/${seg(id)}/status`, {
        method: 'PUT',
        body: json({ status }),
      }),

    async remove(id, options) {
      const query = options?.removeAssignments ? '?removeAssignments=true' : '';
      try {
        await apiRequest<boolean>(`${BASE}/${seg(id)}${query}`, {
          method: 'DELETE',
        });
      } catch (err) {
        if (isConflict(err)) throw new TemplateInUseError(err.message);
        throw err;
      }
    },

    listAllAssignments: () =>
      apiRequest<TemplateAssignment[]>(`${BASE}/assignments`),

    listAssignments: (roundId) =>
      apiRequest<TemplateAssignment[]>(
        `${BASE}/assignments?roundId=${seg(roundId)}`,
      ),

    assign: (roundId, role, templateId) =>
      apiRequest<TemplateAssignment>(
        `${BASE}/assignments/${seg(roundId)}/${role}`,
        { method: 'PUT', body: json({ templateId }) },
      ),

    async unassign(roundId, role) {
      await apiRequest<boolean>(`${BASE}/assignments/${seg(roundId)}/${role}`, {
        method: 'DELETE',
      });
    },
  };
}

export const evaluationService: EvaluationService = createEvaluationService();
