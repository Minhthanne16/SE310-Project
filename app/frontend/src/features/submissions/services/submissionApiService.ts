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
  // PUT /api/topics/{id}/submissions/{subId}/comment
  comment(
    topicId: string,
    submissionId: string,
    comment: string,
  ): Promise<TopicSubmissions>;
  // POST /api/topics/{id}/submissions/requests
  createRequest(
    topicId: string,
    kind: SubmissionKind,
    content: string,
  ): Promise<TopicSubmissions>;
  // POST /api/topics/{id}/submissions/requests/{requestId}/resolve
  resolveRequest(topicId: string, requestId: string): Promise<TopicSubmissions>;
  grantExtension(
    topicId: string,
    endDate: string,
    reason: string,
  ): Promise<TopicSubmissions>;
  lock(topicId: string, submissionId: string): Promise<TopicSubmissions>;
  markIneligible(topicId: string, reason: string): Promise<TopicSubmissions>;
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
    comment: (topicId, submissionId, comment) =>
      apiRequest<TopicSubmissions>(
        `${path(topicId)}/${encodeURIComponent(submissionId)}/comment`,
        {
          method: 'PUT',
          body: JSON.stringify({ comment }),
        },
      ),
    createRequest: (topicId, kind, content) =>
      apiRequest<TopicSubmissions>(`${path(topicId)}/requests`, {
        method: 'POST',
        body: JSON.stringify({ kind, content }),
      }),
    resolveRequest: (topicId, requestId) =>
      apiRequest<TopicSubmissions>(
        `${path(topicId)}/requests/${encodeURIComponent(requestId)}/resolve`,
        {
          method: 'POST',
        },
      ),
    grantExtension: (topicId, endDate, reason) =>
      apiRequest<TopicSubmissions>(
        `/topics/${encodeURIComponent(topicId)}/thesis/extension`,
        { method: 'POST', body: JSON.stringify({ endDate, reason }) },
      ),
    lock: (topicId, submissionId) =>
      apiRequest<TopicSubmissions>(
        `/topics/${encodeURIComponent(topicId)}/thesis/lock`,
        { method: 'POST', body: JSON.stringify({ submissionId }) },
      ),
    markIneligible: (topicId, reason) =>
      apiRequest<TopicSubmissions>(
        `/topics/${encodeURIComponent(topicId)}/thesis/ineligible`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ),
  };
}

export const submissionService: SubmissionService = createSubmissionService();
