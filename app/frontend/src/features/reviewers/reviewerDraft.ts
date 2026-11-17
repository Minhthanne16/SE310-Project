import type {
  ReviewerBatchItem,
  ReviewerLecturer,
  ReviewerSuggestion,
  ReviewerTopicRow,
} from '@/types/reviewer';

// Bản nháp phân công trên màn Giáo vụ: topicId -> id GVPB đã chọn ('' = chưa chọn).
// Chưa lưu cho tới khi Giáo vụ bấm "Lưu và gửi thông báo" (PDR-062).
export type ReviewerDraft = Record<string, string>;

// Dòng thay đổi được: đủ điều kiện và chưa khóa (PDR-021, PDR-023).
export const isEditable = (row: ReviewerTopicRow): boolean =>
  row.eligible && !row.locked;

export function initialDraft(rows: ReviewerTopicRow[]): ReviewerDraft {
  return Object.fromEntries(rows.map((r) => [r.topicId, r.reviewer?.id ?? '']));
}

// Dòng "bẩn": đã chọn người khác với phân công hiện tại và sửa được.
export function dirtyRows(
  rows: ReviewerTopicRow[],
  draft: ReviewerDraft,
): ReviewerTopicRow[] {
  return rows.filter((r) => {
    const chosen = draft[r.topicId] ?? '';
    return isEditable(r) && chosen !== '' && chosen !== (r.reviewer?.id ?? '');
  });
}

// Áp gợi ý chỉ lên dòng sửa được, chưa có GVPB và chưa được chọn tay.
export function applySuggestions(
  rows: ReviewerTopicRow[],
  draft: ReviewerDraft,
  suggestions: ReviewerSuggestion[],
): { draft: ReviewerDraft; applied: string[]; notes: Record<string, string> } {
  const next = { ...draft };
  const applied: string[] = [];
  const notes: Record<string, string> = {};
  for (const s of suggestions) {
    const row = rows.find((r) => r.topicId === s.topicId);
    if (!row || !isEditable(row) || row.reviewer || next[s.topicId]) continue;
    if (s.lecturerId) {
      next[s.topicId] = s.lecturerId;
      applied.push(s.topicId);
    } else notes[s.topicId] = s.reason;
  }
  return { draft: next, applied, notes };
}

// Số đề tài phản biện dự kiến của từng GV nếu lưu bản nháp (dòng bẩn thay phân công hiện tại).
export function projectedLoad(
  lecturers: ReviewerLecturer[],
  rows: ReviewerTopicRow[],
  draft: ReviewerDraft,
): Record<string, number> {
  const load = Object.fromEntries(lecturers.map((l) => [l.id, l.reviewCount]));
  for (const row of dirtyRows(rows, draft)) {
    if (row.reviewer && row.reviewer.id in load) load[row.reviewer.id] -= 1;
    const chosen = draft[row.topicId];
    if (chosen in load) load[chosen] += 1;
  }
  return load;
}

// Payload của lô: mỗi dòng bẩn kèm GVPB hiện tại để máy chủ phát hiện thay đổi đồng thời.
export function buildBatch(
  rows: ReviewerTopicRow[],
  draft: ReviewerDraft,
): ReviewerBatchItem[] {
  return dirtyRows(rows, draft).map((r) => ({
    topicId: r.topicId,
    reviewerId: draft[r.topicId],
    expectedReviewerId: r.reviewer?.id ?? null,
  }));
}

// Gán một GV cho nhiều dòng; bỏ qua dòng khóa, chưa đủ điều kiện và dòng GVHD là chính GV đó.
export function assignMany(
  rows: ReviewerTopicRow[],
  draft: ReviewerDraft,
  topicIds: string[],
  lecturerId: string,
): { draft: ReviewerDraft; applied: number; skipped: number } {
  const next = { ...draft };
  let applied = 0;
  for (const id of topicIds) {
    const row = rows.find((r) => r.topicId === id);
    if (row && isEditable(row) && row.supervisor.id !== lecturerId) {
      next[id] = lecturerId;
      applied += 1;
    }
  }
  return { draft: next, applied, skipped: topicIds.length - applied };
}
