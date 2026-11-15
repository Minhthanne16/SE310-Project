import { apiRequest } from '@/api/request';
import type { SubmissionKind, TopicSubmissions } from '@/types/submission';

export interface SubmissionService {
  // GET /api/topics/{id}/submissions: 404 khi không có quan hệ với đề tài.
  list(topicId: string): Promise<TopicSubmissions>;
  // POST multipart (kind, note, file): 400 tệp/ghi chú không hợp lệ, 403 không
  // phải thành viên nhóm, 409 hết hạn hoặc đề tài chưa/không còn nhận bài,
  // 503 kho lưu trữ không sẵn sàng.
  submit(
    topicId: string,
    kind: SubmissionKind,
    file: File,
    note: string,
  ): Promise<TopicSubmissions>;
}

const path = (topicId: string) =>
  `/topics/${encodeURIComponent(topicId)}/submissions`;

export function createSubmissionService(): SubmissionService {
  return {
    list: (topicId) => apiRequest<TopicSubmissions>(path(topicId)),
    submit: (topicId, kind, file, note) => {
      const body = new FormData();
      body.append('kind', kind);
      if (note.trim()) body.append('note', note.trim());
      body.append('file', file, file.name);
      return apiRequest<TopicSubmissions>(path(topicId), {
        method: 'POST',
        body,
      });
    },
  };
}

export const submissionService: SubmissionService = createSubmissionService();
