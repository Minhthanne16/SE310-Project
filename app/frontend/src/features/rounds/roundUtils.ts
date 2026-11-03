import type {
  Milestone,
  MilestoneErrors,
  MilestoneKey,
  MilestoneStatus,
  Round,
  RoundStage,
  RoundTask,
} from '@/types/round';

const DAY = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  // Khứ hồi để loại ngày không có thật (ví dụ 2026-02-30).
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
  return new Date(toTime(iso) + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toTime(toIso) - toTime(fromIso)) / DAY);
}

// yyyy-MM-dd → dd/MM/yyyy; chưa đặt ngày thì trả "Chưa đặt".
export function formatDate(iso: string): string {
  if (!isIsoDate(iso)) return 'Chưa đặt';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

const hasDates = (m: Milestone) =>
  isIsoDate(m.startDate) && isIsoDate(m.endDate);

export function milestoneStatus(m: Milestone, today: string): MilestoneStatus {
  if (!hasDates(m)) return 'Sắp tới';
  if (today > m.endDate) return 'Đã qua';
  if (today >= m.startDate) return 'Đang diễn ra';
  return 'Sắp tới';
}

// Phần trăm thời gian đã trôi qua của mốc (0 nếu chưa tới, 100 nếu đã qua).
export function milestoneProgress(m: Milestone, today: string): number {
  const status = milestoneStatus(m, today);
  if (status === 'Đã qua') return hasDates(m) ? 100 : 0;
  if (status === 'Sắp tới') return 0;
  const total = daysBetween(m.startDate, m.endDate) + 1;
  const done = daysBetween(m.startDate, today) + 1;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

export function currentMilestone(
  round: Round,
  today: string,
): Milestone | undefined {
  return round.milestones.find(
    (m) => milestoneStatus(m, today) === 'Đang diễn ra',
  );
}

// Khoảng tuần của đợt: tuần 1 bắt đầu từ thứ Hai của tuần chứa mốc sớm nhất.
export interface RoundSpan {
  start: string;
  weeks: number;
}

const mondayOf = (iso: string) => {
  const dow = new Date(toTime(iso)).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
};

export function roundSpan(milestones: Milestone[]): RoundSpan | null {
  const dated = milestones.filter(hasDates);
  if (dated.length === 0) return null;
  const first = dated.reduce(
    (min, m) => (m.startDate < min ? m.startDate : min),
    dated[0].startDate,
  );
  const last = dated.reduce(
    (max, m) => (m.endDate > max ? m.endDate : max),
    dated[0].endDate,
  );
  const start = mondayOf(first);
  return { start, weeks: Math.floor(daysBetween(start, last) / 7) + 1 };
}

// Số tuần (từ 1) của một ngày trong đợt; ngoài khoảng trả null.
export function weekOf(span: RoundSpan, iso: string): number | null {
  const week = Math.floor(daysBetween(span.start, iso) / 7) + 1;
  return week >= 1 && week <= span.weeks ? week : null;
}

export function currentWeek(round: Round, today: string): number | null {
  const span = roundSpan(round.milestones);
  return span ? weekOf(span, today) : null;
}

// Kiểm tra từng mốc: bắt đầu ≤ kết thúc, và mốc sau không bắt đầu sớm hơn mốc
// trước (thứ tự không giảm theo ngày bắt đầu). Mốc chưa đặt ngày được bỏ qua
// ở bước kiểm tra thứ tự.
export function validateMilestones(milestones: Milestone[]): MilestoneErrors {
  const errors: MilestoneErrors = {};
  let previous: Milestone | undefined;
  for (const m of milestones) {
    const start = m.startDate.trim();
    const end = m.endDate.trim();
    if (!start && !end) continue;
    if (!start || !end || !isIsoDate(start) || !isIsoDate(end)) {
      errors[m.key] = 'Nhập đủ ngày bắt đầu và ngày kết thúc.';
      continue;
    }
    if (start > end) {
      errors[m.key] = 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu.';
      continue;
    }
    if (previous && start < previous.startDate) {
      errors[m.key] =
        `Mốc này bắt đầu trước mốc “${previous.name}”. Các mốc phải theo thứ tự thời gian.`;
      continue;
    }
    previous = m;
  }
  return errors;
}

// Lý do chặn mở đợt (PDR-032): đủ chín mốc, mỗi mốc có ngày và đúng thứ tự.
// Mỗi phần tử là một dòng "Tên mốc: vấn đề"; rỗng nghĩa là mở được.
export function openBlockers(round: Round): string[] {
  const errors = validateMilestones(round.milestones);
  const blockers: string[] = [];
  for (const m of round.milestones) {
    if (!m.startDate.trim() && !m.endDate.trim())
      blockers.push(`${m.name}: chưa đặt ngày`);
    else if (errors[m.key]) blockers.push(`${m.name}: ${errors[m.key]}`);
  }
  return blockers;
}

// Việc chưa xong khi mở đợt nhưng không chặn (PDR-033): thiếu giảng viên,
// sinh viên. Phần mốc xem openBlockers.
export function setupWarnings(round: Round): string[] {
  const warnings: string[] = [];
  if (round.lecturerIds.length === 0) warnings.push('chưa có giảng viên');
  if (round.studentIds.length === 0) warnings.push('chưa có sinh viên');
  return warnings;
}

// Ngày kết thúc (yyyy-MM-dd) của một mốc; rỗng nếu chưa đặt ngày hợp lệ.
export function milestoneEnd(round: Round, key: MilestoneKey): string {
  const end = round.milestones.find((m) => m.key === key)?.endDate ?? '';
  return isIsoDate(end) ? end : '';
}

// Giảng viên gửi đề tài từ NGÀY BẮT ĐẦU đến hết ngày kết thúc (23:59) của mốc
// "GV gửi đề tài".
export const submissionEnd = (round: Round) =>
  milestoneEnd(round, 'topicSubmission');

// Đăng ký đề tài tự đóng cuối ngày kết thúc mốc "Công bố đề tài · SV đăng ký".
export const registrationEnd = (round: Round) =>
  milestoneEnd(round, 'topicRegistration');

// Hạn chốt bản cuối: hết ngày kết thúc mốc "Chốt bản cuối · công bố"; sau đó
// hệ thống chốt phiên bản mới nhất nên công bố kết quả không cần chờ nhóm chốt
// (PDR-011, PDR-049).
export const finalLockEnd = (round: Round) => milestoneEnd(round, 'finalize');

export function finalLockClosed(round: Round, today: string): boolean {
  const end = finalLockEnd(round);
  return end !== '' && today > end;
}

export function submissionClosed(round: Round, today: string): boolean {
  const end = submissionEnd(round);
  return end !== '' && today > end;
}

export function registrationClosed(round: Round, today: string): boolean {
  const end = registrationEnd(round);
  return end !== '' && today > end;
}

// Số ngày sinh viên còn đăng ký được tính cả hôm nay, đến 23:59 ngày kết thúc;
// 0 khi đã hết hạn, null khi mốc chưa đặt ngày.
export function registrationDaysLeft(
  round: Round,
  today: string,
): number | null {
  const end = registrationEnd(round);
  if (end === '') return null;
  return today > end ? 0 : daysBetween(today, end) + 1;
}

// Cùng nội dung với backend (RoundRules.RegistrationEndedMessage).
export const registrationEndedMessage = (endIso: string) =>
  `Đã hết thời gian sinh viên đăng ký đề tài (hết ngày ${formatDate(endIso)}). Sửa mốc “Công bố đề tài · SV đăng ký” ở tab Cấu hình rồi công bố.`;

export const ROUND_NOT_RUNNING_PUBLISH_MESSAGE =
  'Chỉ công bố được danh sách đề tài của đợt đang diễn ra.';
export const ROUND_ALREADY_PUBLISHED_MESSAGE =
  'Danh sách đề tài của đợt đã được công bố.';
export const ROUND_NO_TOPICS_PUBLISH_MESSAGE = 'Chưa có đề tài để công bố.';

// Điều kiện công bố danh sách đề tài (tab Đề tài của chi tiết đợt). Không bị
// chặn bởi hạn "GV gửi đề tài": công bố sớm chỉ cảnh báo. Lý do chặn là null
// khi công bố được.
export function publishBlocker(round: Round, today: string): string | null {
  if (round.topicsPublishedAt !== null) return ROUND_ALREADY_PUBLISHED_MESSAGE;
  if (round.status !== 'Đang diễn ra') return ROUND_NOT_RUNNING_PUBLISH_MESSAGE;
  if (round.topicSummary.total === 0) return ROUND_NO_TOPICS_PUBLISH_MESSAGE;
  if (registrationClosed(round, today))
    return registrationEndedMessage(registrationEnd(round));
  return null;
}

// Giai đoạn của đợt Đang diễn ra; các đợt khác không có giai đoạn (null).
export function roundStage(round: Round, today: string): RoundStage | null {
  if (round.status !== 'Đang diễn ra') return null;
  if (round.topicsPublishedAt === null)
    return submissionClosed(round, today)
      ? 'Chờ công bố danh sách'
      : 'GV gửi đề tài';
  if (!registrationClosed(round, today)) return 'SV đăng ký';
  // Chỉ sẵn sàng kết thúc khi mốc "Chốt bản cuối · công bố" đã tới và mọi đề
  // tài có nhóm đã công bố kết quả; trước đó là giai đoạn Thực hiện.
  const finalize = round.milestones.find((m) => m.key === 'finalize');
  const finalizeReached =
    finalize !== undefined && milestoneStatus(finalize, today) !== 'Sắp tới';
  return finalizeReached && round.topicSummary.pendingResultCount === 0
    ? 'Sẵn sàng kết thúc'
    : 'Thực hiện';
}

// Cùng nội dung với backend khi chặn kết thúc đợt (PDR-031); null = kết thúc
// được. Đề tài Không có nhóm không tính vào pendingResultCount.
export function finishBlockedMessage(round: Round): string | null {
  const n = round.topicSummary.pendingResultCount;
  return n > 0
    ? `Còn ${n} đề tài chưa công bố kết quả. Công bố hết ở trang Kết quả (/giao-vu/ket-qua) rồi mới kết thúc được đợt. Đề tài Không có nhóm không tính.`
    : null;
}

const SOON_DAYS = 7;

export const PUBLISH_TASK_TEXT =
  'Đã hết hạn giảng viên gửi đề tài. Xem và công bố danh sách.';

// Việc cần xử lý của giáo vụ, suy ra từ đợt và ngày hôm nay (demo).
export function deriveTasks(round: Round, today: string): RoundTask[] {
  if (round.status === 'Đã kết thúc') return [];
  const tasks: RoundTask[] = [];
  const missing = round.milestones.filter((m) => !hasDates(m)).length;
  if (missing > 0)
    tasks.push({
      id: 'missing-dates',
      text: `${missing} mốc chưa có ngày. Hoàn tất cấu hình mốc.`,
      tab: 'cau-hinh',
    });
  if (Object.keys(validateMilestones(round.milestones)).length > 0)
    tasks.push({
      id: 'milestone-order',
      text: 'Có mốc sai thứ tự. Sửa trong cấu hình.',
      tab: 'cau-hinh',
    });
  if (round.lecturerIds.length === 0)
    tasks.push({
      id: 'no-lecturers',
      text: 'Đợt chưa có giảng viên.',
      tab: 'giang-vien',
    });
  if (round.studentIds.length === 0)
    tasks.push({
      id: 'no-students',
      text: 'Đợt chưa có sinh viên.',
      tab: 'sinh-vien',
    });
  if (round.status === 'Đang diễn ra') {
    for (const m of round.milestones) {
      if (milestoneStatus(m, today) !== 'Đang diễn ra') continue;
      const left = daysBetween(today, m.endDate);
      if (left <= SOON_DAYS)
        tasks.push({
          id: `ending-${m.key}`,
          text:
            left === 0
              ? `Mốc “${m.name}” kết thúc hôm nay.`
              : `Mốc “${m.name}” kết thúc sau ${left} ngày.`,
          tab: 'tien-do',
        });
    }
    if (roundStage(round, today) === 'Chờ công bố danh sách')
      tasks.push({
        id: 'publish-topics',
        text: PUBLISH_TASK_TEXT,
        tab: 'de-tai',
      });
    // Kết quả chỉ cần công bố khi mốc "Chốt bản cuối · công bố" đã tới.
    const finalize = round.milestones.find((m) => m.key === 'finalize');
    if (
      round.topicSummary.pendingResultCount > 0 &&
      finalize &&
      milestoneStatus(finalize, today) !== 'Sắp tới'
    )
      tasks.push({
        id: 'pending-results',
        text: `${round.topicSummary.pendingResultCount} đề tài chưa công bố kết quả.`,
        tab: 'tien-do',
      });
  }
  return tasks;
}

const ddMM = (iso: string) => formatDate(iso).slice(0, 5);

export interface RoundProgressInfo {
  // Dòng đậm: mốc hiện tại hoặc tình trạng đợt.
  milestone: string;
  // "Tuần 6/20", "0/20", "20/20".
  weeks: string;
  percent: number;
}

// Tóm tắt tiến độ cho danh sách đợt (artboard: "Tiến độ · mốc hiện tại").
export function roundProgress(round: Round, today: string): RoundProgressInfo {
  const span = roundSpan(round.milestones);
  const total = span ? span.weeks : 0;
  const totalText = total > 0 ? String(total) : '–';
  if (round.status === 'Nháp') {
    return {
      milestone: span
        ? `Chưa mở · bắt đầu ${formatDate(span.start)}`
        : 'Chưa mở · chưa đặt ngày',
      weeks: `0/${totalText}`,
      percent: 0,
    };
  }
  if (round.status === 'Đã kết thúc') {
    const ends = round.milestones.map((m) => m.endDate).filter(isIsoDate);
    const last = ends.length > 0 ? ends.reduce((a, b) => (b > a ? b : a)) : '';
    return {
      milestone: last ? `Đã kết thúc ${formatDate(last)}` : 'Đã kết thúc',
      weeks: `${totalText}/${totalText}`,
      percent: 100,
    };
  }
  const current = currentMilestone(round, today);
  let week = 0;
  if (span) {
    const raw = Math.floor(daysBetween(span.start, today) / 7) + 1;
    week = Math.min(Math.max(raw, 0), span.weeks);
  }
  return {
    milestone: current
      ? `${current.name} · hạn ${ddMM(current.endDate)}`
      : 'Chưa có mốc đang diễn ra',
    weeks: total > 0 ? `Tuần ${week}/${total}` : '–',
    percent: total > 0 ? Math.round((week / total) * 100) : 0,
  };
}

// Thạc sĩ gọi là học viên (03: Danh sách đợt), các chương trình khác là sinh viên.
export function studentNoun(
  program: Round['program'],
): 'học viên' | 'sinh viên' {
  return program === 'Thạc sĩ' ? 'học viên' : 'sinh viên';
}

// Ngày bắt đầu sớm nhất trong các mốc (yyyy-MM-dd), rỗng nếu chưa có ngày.
export function earliestStart(round: Round): string {
  const starts = round.milestones.map((m) => m.startDate).filter(isIsoDate);
  return starts.length > 0 ? starts.reduce((a, b) => (b < a ? b : a)) : '';
}
