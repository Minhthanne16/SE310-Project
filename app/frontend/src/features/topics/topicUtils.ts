import {
  SCORE_ROLES,
  type LecturerLoad,
  type LoadLevel,
  type RoleScores,
  type ScoreRole,
  type Topic,
} from '@/types/topic';

// Mặc định khi không truyền mức của đợt: 0 = CHƯA ĐẶT MỨC nên không cảnh báo
// (0 ở mức tối đa là không giới hạn). Mức thật đặt theo từng đợt ở tab Cấu hình
// (Round.lecturerLoadMin/Max), chỉ để cảnh báo, không chặn.
export const LECTURER_LOAD_MIN = 0;
export const LECTURER_LOAD_MAX = 0;

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
  if (max > 0 && count > max) return 'over';
  if (count < min) return 'below';
  return 'ok';
}

export function lecturerLoads(
  topics: Topic[],
  lecturerIds: string[],
  limits: { min: number; max: number } = {
    min: LECTURER_LOAD_MIN,
    max: LECTURER_LOAD_MAX,
  },
): Record<string, LecturerLoad> {
  const loads: Record<string, LecturerLoad> = {};
  for (const id of lecturerIds) {
    const count = topics.filter(
      (t) => t.supervisor.id === id && countsTowardLoad(t),
    ).length;
    loads[id] = {
      lecturerId: id,
      count,
      min: limits.min,
      max: limits.max,
      level: loadLevel(count, limits.min, limits.max),
    };
  }
  return loads;
}

// (CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6, thang 10, làm tròn 2 chữ số; chỉ tính
// khi đủ bốn phiếu (BUSINESS_RULES). Cảnh báo lệch điểm tách riêng ở
// scoreDeviations.
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

export interface ScoreDeviation {
  // Một điểm hội đồng (CTHĐ/TKHĐ) và một điểm GV (CBHD/CBPB).
  council: ScoreRole;
  lecturer: ScoreRole;
  // Chênh lệch tuyệt đối, đã làm tròn hai chữ số.
  diff: number;
}

export const DEVIATION_THRESHOLD = 2;

// Bốn cặp chéo CTHĐ–CBHD, CTHĐ–CBPB, TKHĐ–CBHD, TKHĐ–CBPB (PDR-007); chênh từ
// 2 điểm trở lên thì lệch. Cặp thiếu điểm bị bỏ qua; CT–TK và HD–PB không tính.
export function scoreDeviations(scores: RoleScores): {
  pairs: ScoreDeviation[];
  roles: Set<ScoreRole>;
} {
  const pairs: ScoreDeviation[] = [];
  const roles = new Set<ScoreRole>();
  for (const council of ['CTHĐ', 'TKHĐ'] as const)
    for (const lecturer of ['CBHD', 'CBPB'] as const) {
      const a = scores[council];
      const b = scores[lecturer];
      if (a === null || b === null) continue;
      // So sánh theo phần trăm điểm nguyên để tránh sai số nhị phân.
      const cents = Math.abs(Math.round(a * 100) - Math.round(b * 100));
      if (cents >= DEVIATION_THRESHOLD * 100) {
        pairs.push({ council, lecturer, diff: cents / 100 });
        roles.add(council);
        roles.add(lecturer);
      }
    }
  return { pairs, roles };
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
    case 'Không có nhóm':
      return '—';
    case 'Đã đăng ký':
      return 'Chờ nộp đề cương';
    default:
      return 'Chưa nộp';
  }
}

// Số hiển thị điểm thành phần: một chữ số thập phân (8,5), hai chữ số khi điểm
// có phần trăm (7,05) để không làm mất dữ liệu.
export function formatComponentScore(value: number | null): string {
  if (value === null) return '—';
  const digits = Math.round(value * 100) % 10 === 0 ? 1 : 2;
  return value.toFixed(digits).replace('.', ',');
}

export type ThesisTone = 'none' | 'submitted' | 'final';

// Ô "Khóa luận" của danh sách: Chưa nộp, Đã nộp hoặc Chốt bản cuối kèm số
// phiên bản. Đề tài Đã hoàn tất là đề tài đã chốt bản cuối.
export function thesisCell(topic: Topic): {
  label: string;
  sub: string;
  tone: ThesisTone;
} {
  const count = topic.submissions.length;
  if (count === 0)
    return { label: 'Chưa nộp', sub: 'Chưa có phiên bản', tone: 'none' };
  const final = topic.status === 'Đã hoàn tất';
  return {
    label: final ? 'Chốt bản cuối' : 'Đã nộp',
    sub: `${count} phiên bản`,
    tone: final ? 'final' : 'submitted',
  };
}

// "Nguyễn Văn An" → "N.V. An"
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  return `${parts
    .slice(0, -1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join('')} ${last}`;
}

// Chữ viết tắt cho avatar, bỏ học hàm/học vị ("TS.", "ThS.", "PGS.TS.").
export function avatarInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => !p.endsWith('.'));
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}

// yyyy-MM-ddTHH:mm:ss → dd/MM/yyyy và HH:mm (không qua múi giờ).
export function dateOf(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

const WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

// "Thứ Hai 22/12/2026 · 08:45" từ yyyy-MM-ddTHH:mm:ss (thứ tính theo UTC để
// không lệch múi giờ).
export function formatDefenseStart(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${dateOf(iso)} · ${timeOf(iso)}`;
}

export function groupLabel(topic: Topic): string {
  return topic.group.length > 0
    ? topic.group.map((m) => m.name).join(', ')
    : '—';
}
