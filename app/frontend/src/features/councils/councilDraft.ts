import type {
  Council,
  CouncilBoard,
  CouncilInput,
  CouncilPoolTopic,
  CouncilSlot,
} from '@/types/council';

// Bản nháp trên màn sửa hội đồng (P06, PDR-017/063). Hàm thuần, không gọi API.

export interface DraftSlot {
  topicId: string;
  code: string;
  title: string;
  supervisorId: string;
  supervisorName: string;
  reviewerName: string | null;
  groupText: string;
  thesisVersionCount: number;
  start: string;
  end: string;
}

export interface CouncilDraft {
  // null khi tạo mới.
  id: string | null;
  version: number | null;
  published: boolean;
  name: string;
  chairId: string;
  secretaryId: string;
  date: string;
  room: string;
  slots: DraftSlot[];
  // Bắt buộc khi sửa lịch đã công bố (PDR-018).
  reason: string;
}

// Gợi ý điền sẵn; Giáo vụ sửa được từng lượt, không phải thời lượng bắt buộc (PDR-017).
export const DEFAULT_SLOT_MINUTES = 45;
export const MIN_SLOT_MINUTES = 10;
export const MAX_SLOT_MINUTES = 180;
const DEFAULT_START = '07:30';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (value: string) => TIME.test(value.trim());

export function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

// null khi vượt quá 23:59 (không tràn sang ngày sau).
export function fromMinutes(total: number): string | null {
  if (total < 0 || total > 23 * 60 + 59) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const groupText = (group: { name: string }[]) =>
  group.length > 0 ? group.map((m) => m.name).join(', ') : '—';

export function slotFromCouncil(slot: CouncilSlot): DraftSlot {
  return {
    topicId: slot.topicId,
    code: slot.code,
    title: slot.title,
    supervisorId: slot.supervisor.id,
    supervisorName: slot.supervisor.name,
    reviewerName: slot.reviewer?.name ?? null,
    groupText: groupText(slot.group),
    thesisVersionCount: slot.thesisVersionCount,
    start: slot.start,
    end: slot.end,
  };
}

export function draftFromCouncil(council: Council): CouncilDraft {
  return {
    id: council.id,
    version: council.version,
    published: council.status === 'Đã công bố',
    name: council.name,
    chairId: council.chair.id,
    secretaryId: council.secretary.id,
    date: council.date,
    room: council.room,
    slots: council.slots.map(slotFromCouncil),
    reason: '',
  };
}

// Tên gợi ý "Hội đồng n" (tên do Giáo vụ tự đặt, DESIGN/03).
export function newDraft(board: CouncilBoard): CouncilDraft {
  const used = new Set(board.councils.map((c) => c.name.trim().toLowerCase()));
  let n = board.councils.length + 1;
  while (used.has(`hội đồng ${n}`)) n += 1;
  return {
    id: null,
    version: null,
    published: false,
    name: `Hội đồng ${n}`,
    chairId: '',
    secretaryId: '',
    date: board.round.defenseStart,
    room: '',
    slots: [],
    reason: '',
  };
}

// Thêm đề tài từ kho vào cuối lịch: bắt đầu ngay khi lượt trước kết thúc, độ dài như lượt trước.
export function addSlot(
  draft: CouncilDraft,
  topic: CouncilPoolTopic,
): CouncilDraft {
  if (draft.slots.some((s) => s.topicId === topic.topicId)) return draft;
  const last = draft.slots[draft.slots.length - 1];
  const length =
    last &&
    isTime(last.start) &&
    isTime(last.end) &&
    toMinutes(last.end) > toMinutes(last.start)
      ? toMinutes(last.end) - toMinutes(last.start)
      : DEFAULT_SLOT_MINUTES;
  const start = last && isTime(last.end) ? last.end : DEFAULT_START;
  const end = fromMinutes(toMinutes(start) + length) ?? '';
  return {
    ...draft,
    slots: [
      ...draft.slots,
      {
        topicId: topic.topicId,
        code: topic.code,
        title: topic.title,
        supervisorId: topic.supervisor.id,
        supervisorName: topic.supervisor.name,
        reviewerName: topic.reviewer?.name ?? null,
        groupText: groupText(topic.group),
        thesisVersionCount: topic.thesisVersionCount,
        start,
        end,
      },
    ],
  };
}

export function removeSlot(draft: CouncilDraft, topicId: string): CouncilDraft {
  return { ...draft, slots: draft.slots.filter((s) => s.topicId !== topicId) };
}

// Đổi thứ tự hai lượt liền nhau, giữ nguyên khung giờ theo vị trí (lượt lên trên nhận giờ của vị trí mới).
export function moveSlot(
  draft: CouncilDraft,
  index: number,
  delta: -1 | 1,
): CouncilDraft {
  const target = index + delta;
  if (target < 0 || target >= draft.slots.length) return draft;
  const slots = draft.slots.slice();
  const a = slots[index];
  const b = slots[target];
  slots[index] = { ...b, start: a.start, end: a.end };
  slots[target] = { ...a, start: b.start, end: b.end };
  return { ...draft, slots };
}

export function setSlotTime(
  draft: CouncilDraft,
  topicId: string,
  field: 'start' | 'end',
  value: string,
): CouncilDraft {
  return {
    ...draft,
    slots: draft.slots.map((s) =>
      s.topicId === topicId ? { ...s, [field]: value } : s,
    ),
  };
}

export type AutoFillResult =
  { ok: true; draft: CouncilDraft } | { ok: false; error: string };

// "Điền giờ tự động": các lượt nối tiếp từ giờ bắt đầu, mỗi lượt `minutes` phút. Chỉ là công cụ điền sẵn.
export function autoFill(
  draft: CouncilDraft,
  start: string,
  minutes: number,
): AutoFillResult {
  if (!isTime(start))
    return { ok: false, error: 'Nhập giờ dạng HH:MM, ví dụ 07:30.' };
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_SLOT_MINUTES ||
    minutes > MAX_SLOT_MINUTES
  )
    return {
      ok: false,
      error: `Nhập số phút từ ${MIN_SLOT_MINUTES} đến ${MAX_SLOT_MINUTES}.`,
    };
  const base = toMinutes(start.trim());
  const slots: DraftSlot[] = [];
  for (let i = 0; i < draft.slots.length; i++) {
    const s = fromMinutes(base + minutes * i);
    const e = fromMinutes(base + minutes * (i + 1));
    if (!s || !e)
      return {
        ok: false,
        error: 'Lịch vượt quá 23:59; giảm số phút hoặc giờ bắt đầu.',
      };
    slots.push({ ...draft.slots[i], start: s, end: e });
  }
  return { ok: true, draft: { ...draft, slots } };
}

// Lỗi giờ của từng lượt, hiện tại chỗ (máy chủ vẫn kiểm tra lại toàn bộ).
export function slotErrors(draft: CouncilDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  let previous: DraftSlot | null = null;
  for (const slot of draft.slots) {
    if (!isTime(slot.start) || !isTime(slot.end))
      errors[slot.topicId] = 'Nhập giờ dạng HH:MM, ví dụ 07:30.';
    else if (toMinutes(slot.end) <= toMinutes(slot.start))
      errors[slot.topicId] = 'Giờ kết thúc phải sau giờ bắt đầu.';
    else if (previous && toMinutes(slot.start) < toMinutes(previous.end))
      errors[slot.topicId] = `Bắt đầu trước khi ${previous.code} kết thúc.`;
    if (
      isTime(slot.start) &&
      isTime(slot.end) &&
      toMinutes(slot.end) > toMinutes(slot.start)
    )
      previous = slot;
  }
  return errors;
}

// Lỗi các trường chung, hiện sau khi bấm Lưu.
export function fieldErrors(
  draft: CouncilDraft,
): Partial<
  Record<'name' | 'chair' | 'secretary' | 'date' | 'room' | 'reason', string>
> {
  const errors: Partial<
    Record<'name' | 'chair' | 'secretary' | 'date' | 'room' | 'reason', string>
  > = {};
  if (!draft.name.trim()) errors.name = 'Nhập tên hội đồng.';
  if (!draft.chairId) errors.chair = 'Chọn Chủ tịch.';
  if (!draft.secretaryId) errors.secretary = 'Chọn Thư ký.';
  else if (draft.secretaryId === draft.chairId)
    errors.secretary = 'Chủ tịch và Thư ký phải là hai giảng viên khác nhau.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    errors.date = 'Chọn ngày bảo vệ.';
  if (!draft.room.trim()) errors.room = 'Nhập phòng bảo vệ.';
  if (draft.published && !draft.reason.trim())
    errors.reason = 'Nhập lý do sửa lịch đã công bố.';
  return errors;
}

// GVHD đang ngồi hội đồng: không thêm đề tài đó (BUSINESS_RULES).
export const supervisorInCouncil = (
  draft: CouncilDraft,
  supervisorId: string,
) =>
  supervisorId !== '' &&
  (supervisorId === draft.chairId || supervisorId === draft.secretaryId);

export function toInput(draft: CouncilDraft, roundId: string): CouncilInput {
  return {
    roundId,
    name: draft.name.trim(),
    chairId: draft.chairId,
    secretaryId: draft.secretaryId,
    date: draft.date,
    room: draft.room.trim(),
    slots: draft.slots.map((s) => ({
      topicId: s.topicId,
      start: s.start.trim(),
      end: s.end.trim(),
    })),
    ...(draft.version !== null ? { expectedVersion: draft.version } : {}),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  };
}

// dd/MM/yyyy từ yyyy-MM-dd.
export function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '—';
}

export function span(slots: { start: string; end: string }[]): string | null {
  if (slots.length === 0) return null;
  return `${slots[0].start}–${slots[slots.length - 1].end}`;
}
