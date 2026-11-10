import { nameKey } from '@/features/rounds/roundValidation';
import type { TopicStatus } from '@/types/round';
import {
  SCORE_ROLES,
  type LecturerLoad,
  type LoadLevel,
  type RoleScores,
  type ScoreRole,
  type StudentScore,
  type Topic,
  type TopicFilters,
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
  return (
    topic.status !== 'Chờ GV duyệt' &&
    topic.status !== 'Bị từ chối' &&
    topic.status !== 'Đã hủy'
  );
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

// Trạng thái đã lưu thắng trạng thái suy ra từ điểm (PDR-049): đã xác nhận,
// đã công bố hoặc đã kết thúc thì phiếu điểm không đổi được trạng thái nữa.
const GRADING_DERIVABLE: readonly TopicStatus[] = [
  'Đang thực hiện',
  'Đang cho điểm',
  'Đã cho điểm',
  'Có lệch điểm',
];

// Phiếu điểm của từng sinh viên trong nhóm; sinh viên chưa có dòng điểm có đủ
// bốn ô trống. Nhóm chưa có thành viên thì lấy theo các dòng điểm hiện có.
export function groupScoreRows(topic: Topic): StudentScore[] {
  if (topic.group.length === 0) return topic.scores;
  const byId = new Map(topic.scores.map((s) => [s.studentId, s]));
  return topic.group.map(
    (m) =>
      byId.get(m.id) ?? {
        studentId: m.id,
        code: m.code,
        name: m.name,
        scores: { CTHĐ: null, TKHĐ: null, CBHD: null, CBPB: null },
      },
  );
}

// Sinh viên chưa đủ bốn phiếu và các vai trò còn thiếu của họ.
export function missingScores(
  topic: Topic,
): { name: string; roles: ScoreRole[] }[] {
  return groupScoreRows(topic)
    .map((s) => ({
      name: s.name,
      roles: SCORE_ROLES.filter((r) => s.scores[r] === null),
    }))
    .filter((s) => s.roles.length > 0);
}

// Có ít nhất một cặp chéo lệch ≥ 2 điểm ở một sinh viên của nhóm.
export function hasScoreDeviation(topic: Topic): boolean {
  return topic.scores.some((s) => scoreDeviations(s.scores).pairs.length > 0);
}

// Trạng thái chấm điểm suy ra từ phiếu của mọi sinh viên trong nhóm (PDR-049):
// chưa có điểm nào thì giữ trạng thái đã lưu; có điểm nhưng chưa đủ bốn phiếu
// cho mọi sinh viên là Đang cho điểm; đủ bốn phiếu mà còn cặp lệch ≥ 2 là Có
// lệch điểm; còn lại là Đã cho điểm. Backend phải tính lại khi xác nhận.
export function gradingStatus(topic: Topic): TopicStatus {
  if (!GRADING_DERIVABLE.includes(topic.status)) return topic.status;
  const any = topic.scores.some((s) =>
    SCORE_ROLES.some((r) => s.scores[r] !== null),
  );
  if (!any) return topic.status;
  const complete = missingScores(topic).length === 0;
  if (!complete) return 'Đang cho điểm';
  return hasScoreDeviation(topic) ? 'Có lệch điểm' : 'Đã cho điểm';
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
    case 'Đã hủy':
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
  const final =
    topic.status === 'Đã hoàn tất' || topic.finalLockedVersionNo !== null;
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

// Sau hạn đăng ký không còn đề tài Đã đăng ký hay Chờ GV duyệt trong đợt
// (PDR-049): đều hiển thị là Đang thực hiện.
export function displayStatus(
  status: TopicStatus,
  registrationOver: boolean,
): TopicStatus {
  return registrationOver &&
    (status === 'Đã đăng ký' || status === 'Chờ GV duyệt')
    ? 'Đang thực hiện'
    : status;
}

// Giảng viên trong các cặp lệch của đề tài (CTHĐ, TKHĐ lấy từ hội đồng); mỗi
// người một lần, thứ tự CBHD, CBPB, CTHĐ, TKHĐ.
export function deviationRecipients(topic: Topic): string[] {
  const roles = new Set<ScoreRole>();
  for (const s of topic.scores)
    for (const role of scoreDeviations(s.scores).roles) roles.add(role);
  const names: Record<ScoreRole, string> = {
    CBHD: topic.supervisor.name,
    CBPB: topic.reviewer?.name ?? 'GV phản biện (chưa phân công)',
    CTHĐ: topic.defense?.chair ?? 'Chủ tịch hội đồng (chưa gán)',
    TKHĐ: topic.defense?.secretary ?? 'Thư ký hội đồng (chưa gán)',
  };
  const out: string[] = [];
  for (const role of ['CBHD', 'CBPB', 'CTHĐ', 'TKHĐ'] as const)
    if (roles.has(role) && !out.includes(names[role])) out.push(names[role]);
  return out;
}

const joinRoles = (roles: ScoreRole[]) => roles.join(', ');

// "Thiếu CTHĐ, TKHĐ của Nguyễn Văn A; thiếu CBPB của Trần Thị B."
export function missingScoresText(topic: Topic): string {
  const missing = missingScores(topic);
  if (missing.length === 0) return '';
  return missing
    .map((m) => `Thiếu ${joinRoles(m.roles)} của ${m.name}`)
    .join('; ');
}

// Lý do không xác nhận được (null = xác nhận được). Suy lại từ phiếu điểm
// chứ không tin trạng thái đã lưu (PDR-049).
export function confirmResultBlocker(topic: Topic): string | null {
  switch (topic.status) {
    case 'Đã xác nhận':
      return 'Đã xác nhận rồi.';
    case 'Đã hoàn tất':
      return 'Đã công bố, không xác nhận lại được.';
    case 'Chờ GV duyệt':
    case 'Đã đăng ký':
      // Sau hạn đăng ký hai trạng thái này hiển thị là Đang thực hiện.
      return 'Chưa có điểm.';
    case 'Chưa đăng ký':
    case 'Bị từ chối':
    case 'Đã hủy':
    case 'Không đủ điều kiện công bố':
    case 'Không có nhóm':
      return `Đề tài đang ở trạng thái ${topic.status}, chưa có kết quả để xác nhận.`;
  }
  switch (gradingStatus(topic)) {
    case 'Đã cho điểm':
      return null;
    case 'Có lệch điểm':
      return 'Còn cặp điểm lệch từ 2 điểm. Giảng viên sửa phiếu hết lệch mới xác nhận được.';
    case 'Đang cho điểm':
      return `Chưa đủ điểm. ${missingScoresText(topic)}.`;
    default:
      return 'Chưa có điểm.';
  }
}

// Lý do không công bố được: phải Đã xác nhận và nhóm đã chốt bản cuối hoặc đã
// hết hạn chốt (finalLockClosed).
export function publishResultBlocker(
  topic: Topic,
  finalLockClosed: boolean,
): string | null {
  if (topic.status === 'Đã hoàn tất') return 'Đã công bố.';
  if (topic.status !== 'Đã xác nhận') {
    const why = confirmResultBlocker(topic);
    return why === null
      ? 'Chưa xác nhận kết quả. Xác nhận trước rồi mới công bố.'
      : `Chưa xác nhận kết quả. ${why}`;
  }
  return topic.finalLockedVersionNo !== null || finalLockClosed
    ? null
    : 'Nhóm chưa chốt bản cuối và chưa hết hạn chốt.';
}

// Lý do không gửi nhắc được (null = gửi được): chỉ khi đủ điểm mà còn lệch.
export function remindDeviationBlocker(topic: Topic): string | null {
  return gradingStatus(topic) === 'Có lệch điểm'
    ? null
    : 'Không có cặp điểm lệch.';
}

// Lọc theo đợt, GVHD, trạng thái và từ khóa (mã/tên đề tài, GV, SV), sắp theo mã.
// Dùng chung cho kho demo và API (lọc ở client).
export function filterTopics(topics: Topic[], f: TopicFilters): Topic[] {
  const keyword = nameKey(f.search ?? '');
  return topics
    .filter(
      (t) =>
        t.roundId === f.roundId &&
        (!f.supervisorId || t.supervisor.id === f.supervisorId) &&
        (!f.status || f.status === 'Tất cả' || t.status === f.status) &&
        (!keyword ||
          nameKey(t.title).includes(keyword) ||
          nameKey(t.code).includes(keyword) ||
          nameKey(t.supervisor.name).includes(keyword) ||
          (t.reviewer !== null && nameKey(t.reviewer.name).includes(keyword)) ||
          t.group.some(
            (m) =>
              nameKey(m.name).includes(keyword) ||
              nameKey(m.code).includes(keyword),
          )),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}
