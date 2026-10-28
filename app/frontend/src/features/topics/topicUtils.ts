import { buildCsv } from '@/lib/csv';
import {
  SCORE_ROLES,
  type LecturerLoad,
  type LoadLevel,
  type RoleScores,
  type Topic,
} from '@/types/topic';

// TẠM THỜI (demo): docs/DESIGN/03 chỉ nói "mức tối thiểu và tối đa của đợt
// chỉ cảnh báo, không chặn" mà không nêu con số. Hai hằng số dưới đây chỉ để
// màn hình có cờ "GV vượt mức"; khi tài liệu chốt giá trị (hoặc đợt có cấu
// hình riêng) thì thay bằng dữ liệu từ đợt.
export const LECTURER_LOAD_MIN = 2;
export const LECTURER_LOAD_MAX = 6;

// Số đề tài của GV = đề tài GV gửi + đề xuất SV đã chấp nhận (03: Đề tài của
// tôi). Đề xuất đang Chờ GV duyệt hoặc Bị từ chối chưa được tính.
export function countsTowardLoad(topic: Topic): boolean {
  if (topic.source === 'GV công bố') return true;
  return topic.status !== 'Chờ GV duyệt' && topic.status !== 'Bị từ chối';
}

export function loadLevel(
  count: number,
  min = LECTURER_LOAD_MIN,
  max = LECTURER_LOAD_MAX,
): LoadLevel {
  if (count > max) return 'over';
  if (count < min) return 'below';
  return 'ok';
}

export function lecturerLoads(
  topics: Topic[],
  lecturerIds: string[],
): Record<string, LecturerLoad> {
  const loads: Record<string, LecturerLoad> = {};
  for (const id of lecturerIds) {
    const count = topics.filter(
      (t) => t.supervisor.id === id && countsTowardLoad(t),
    ).length;
    loads[id] = {
      lecturerId: id,
      count,
      min: LECTURER_LOAD_MIN,
      max: LECTURER_LOAD_MAX,
      level: loadLevel(count),
    };
  }
  return loads;
}

// (CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6, thang 10, làm tròn 2 chữ số; chỉ tính
// khi đủ bốn phiếu (BUSINESS_RULES). Không cảnh báo lệch điểm ở đây: quy tắc
// lệch còn mơ hồ và thuộc màn Kết quả.
export function totalScore(scores: RoleScores): number | null {
  if (SCORE_ROLES.some((role) => scores[role] === null)) return null;
  // Tính bằng phần trăm điểm nguyên để tránh sai số nhị phân ở các giá trị hòa
  // (ví dụ 7,05 × ...), rồi làm tròn nửa lên.
  const cents = (value: number | null) => Math.round((value as number) * 100);
  const sum =
    cents(scores.CTHĐ) +
    cents(scores.TKHĐ) +
    2 * cents(scores.CBHD) +
    2 * cents(scores.CBPB);
  return Math.round(sum / 6) / 100;
}

// Dấu phẩy thập phân theo tiếng Việt.
export function formatScore(value: number | null): string {
  return value === null ? '—' : value.toFixed(2).replace('.', ',');
}

export function latestSubmission(topic: Topic) {
  return topic.submissions.length > 0
    ? topic.submissions[topic.submissions.length - 1]
    : undefined;
}

// Cột "Khóa luận": phiên bản nộp mới nhất, hoặc tiến độ khi chưa nộp.
export function thesisProgress(topic: Topic): string {
  const last = latestSubmission(topic);
  if (last) return `${last.kind} · v${last.versionNo}`;
  switch (topic.status) {
    case 'Chưa đăng ký':
    case 'Chờ GV duyệt':
    case 'Bị từ chối':
      return '—';
    case 'Đã đăng ký':
      return 'Chờ nộp đề cương';
    default:
      return 'Chưa nộp';
  }
}

export function groupLabel(topic: Topic): string {
  return topic.group.length > 0
    ? topic.group.map((m) => m.name).join(', ')
    : '—';
}

export const TOPIC_CSV_HEADER = [
  'Mã',
  'Tên đề tài',
  'Lĩnh vực',
  'GVHD',
  'Nhóm',
  'Nguồn',
  'Trạng thái',
  'Khóa luận',
];

export function buildTopicsCsv(topics: Topic[]): string {
  return buildCsv(
    TOPIC_CSV_HEADER,
    topics.map((t) => [
      t.code,
      t.title,
      t.field,
      t.supervisor.name,
      t.group.map((m) => `${m.code} ${m.name}`).join('; '),
      t.source,
      t.status,
      thesisProgress(t),
    ]),
  );
}
