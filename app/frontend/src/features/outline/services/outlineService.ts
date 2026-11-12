import { ApiError, apiRequest } from '@/api/request';
import type { Outline } from '@/types/outline';
import type { TopicDetailDto } from '@/types/topic';

// Giới hạn và kiểm tra phía trình duyệt khớp OutlineRules (PDR-039, PDR-040);
// máy chủ vẫn kiểm lại chữ ký %PDF- và kích thước.
export const MAX_OUTLINE_BYTES = 20 * 1024 * 1024;

export function outlineFileError(file: File | null): string | null {
  if (!file || file.size === 0) return 'Chọn tệp PDF đề cương.';
  const isPdfName = file.name.toLowerCase().endsWith('.pdf');
  const isPdfType = !file.type || file.type === 'application/pdf';
  if (!isPdfName || !isPdfType) return 'Tệp không phải PDF.';
  if (file.size > MAX_OUTLINE_BYTES) return 'Tệp vượt quá 20 MB.';
  return null;
}

// Đề tài không tồn tại hoặc người xem không thuộc nhóm/GVHD/Giáo vụ (máy chủ trả 404).
export class OutlineNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy đề tài.');
    this.name = 'OutlineNotFoundError';
  }
}

const base = (topicId: string) =>
  `/topics/${encodeURIComponent(topicId)}/outline`;

// Đường dẫn tải PDF qua proxy Next.js; cookie đăng nhập đi kèm vì cùng nguồn.
export const outlineFileUrl = (topicId: string, submissionId: string) =>
  `/api${base(topicId)}/submissions/${encodeURIComponent(submissionId)}/file`;

async function call(path: string, init?: RequestInit): Promise<Outline> {
  try {
    return await apiRequest<Outline>(path, init);
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404)
      throw new OutlineNotFoundError();
    throw err;
  }
}

const post = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export interface OutlineService {
  // Chi tiết đề tài cho phần tổng quan của Không gian đề tài (GET /api/topics/{id}).
  topic(topicId: string): Promise<TopicDetailDto>;
  get(topicId: string): Promise<Outline>;
  submit(topicId: string, file: File, note: string): Promise<Outline>;
  comment(
    topicId: string,
    submissionId: string,
    comment: string,
  ): Promise<Outline>;
  createRequest(topicId: string, content: string): Promise<Outline>;
  resolveRequest(topicId: string, requestId: string): Promise<Outline>;
  approve(topicId: string, submissionId: string): Promise<Outline>;
}

export const outlineService: OutlineService = {
  async topic(topicId) {
    try {
      return await apiRequest<TopicDetailDto>(
        `/topics/${encodeURIComponent(topicId)}`,
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404)
        throw new OutlineNotFoundError();
      throw err;
    }
  },

  get: (topicId) => call(base(topicId)),

  // multipart/form-data: file + note (POST /api/topics/{id}/outline/submissions).
  submit(topicId, file, note) {
    const form = new FormData();
    form.append('file', file);
    if (note.trim()) form.append('note', note.trim());
    return call(`${base(topicId)}/submissions`, { method: 'POST', body: form });
  },

  comment: (topicId, submissionId, comment) =>
    call(
      `${base(topicId)}/submissions/${encodeURIComponent(submissionId)}/comment`,
      post({ comment }, 'PUT'),
    ),

  createRequest: (topicId, content) =>
    call(`${base(topicId)}/requests`, post({ content })),

  resolveRequest: (topicId, requestId) =>
    call(`${base(topicId)}/requests/${encodeURIComponent(requestId)}/resolve`, {
      method: 'POST',
    }),

  approve: (topicId, submissionId) =>
    call(`${base(topicId)}/approve`, post({ submissionId })),
};
