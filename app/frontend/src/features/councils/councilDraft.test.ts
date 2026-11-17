import { describe, expect, it } from 'vitest';
import {
  addSlot,
  autoFill,
  draftFromCouncil,
  fieldErrors,
  formatDay,
  fromMinutes,
  isTime,
  moveSlot,
  newDraft,
  removeSlot,
  setSlotTime,
  slotErrors,
  span,
  supervisorInCouncil,
  toInput,
  type CouncilDraft,
} from '@/features/councils/councilDraft';
import type { Council, CouncilBoard, CouncilPoolTopic } from '@/types/council';

const person = (id: string, name = `GV ${id}`) => ({ id, code: id, name });

const pool = (id: string, supervisor = 'A'): CouncilPoolTopic => ({
  topicId: id,
  code: `DT-${id}`,
  title: `Đề tài ${id}`,
  group: [
    {
      id: `s${id}`,
      code: `SV${id}`,
      name: `SV ${id}`,
      className: 'K1',
      representative: true,
    },
  ],
  supervisor: person(supervisor),
  reviewer: null,
  thesisVersionCount: 0,
  eligible: true,
  blockedReason: null,
});

const empty: CouncilDraft = {
  id: null,
  version: null,
  published: false,
  name: 'Hội đồng 1',
  chairId: 'B',
  secretaryId: 'C',
  date: '2026-10-14',
  room: 'B4.12',
  slots: [],
  reason: '',
};

describe('councilDraft', () => {
  it('nhận giờ HH:MM và chặn giờ tràn ngày', () => {
    expect(isTime('07:30')).toBe(true);
    expect(isTime('7:30')).toBe(false);
    expect(isTime('24:00')).toBe(false);
    expect(fromMinutes(23 * 60 + 59)).toBe('23:59');
    expect(fromMinutes(24 * 60)).toBeNull();
  });

  it('thêm đề tài nối tiếp lượt trước với cùng độ dài, không thêm trùng', () => {
    let draft = addSlot(empty, pool('1'));
    expect(draft.slots[0]).toMatchObject({
      start: '07:30',
      end: '08:15',
      groupText: 'SV 1',
    });
    draft = setSlotTime(draft, '1', 'end', '08:30');
    draft = addSlot(draft, pool('2'));
    expect(draft.slots[1]).toMatchObject({ start: '08:30', end: '09:30' });
    expect(addSlot(draft, pool('2')).slots).toHaveLength(2);
    expect(removeSlot(draft, '1').slots.map((s) => s.topicId)).toEqual(['2']);
  });

  it('đổi thứ tự giữ khung giờ theo vị trí', () => {
    let draft = addSlot(addSlot(empty, pool('1')), pool('2'));
    draft = moveSlot(draft, 1, -1);
    expect(draft.slots.map((s) => [s.topicId, s.start, s.end])).toEqual([
      ['2', '07:30', '08:15'],
      ['1', '08:15', '09:00'],
    ]);
    expect(moveSlot(draft, 0, -1)).toBe(draft);
  });

  it('điền giờ tự động chỉ là công cụ và kiểm tra đầu vào', () => {
    const draft = addSlot(
      addSlot(addSlot(empty, pool('1')), pool('2')),
      pool('3'),
    );
    const filled = autoFill(draft, '13:00', 30);
    expect(
      filled.ok && filled.draft.slots.map((s) => `${s.start}-${s.end}`),
    ).toEqual(['13:00-13:30', '13:30-14:00', '14:00-14:30']);
    expect(autoFill(draft, '1300', 30)).toEqual({
      ok: false,
      error: 'Nhập giờ dạng HH:MM, ví dụ 07:30.',
    });
    expect(autoFill(draft, '13:00', 5).ok).toBe(false);
    expect(autoFill(draft, '13:00', 181).ok).toBe(false);
    expect(autoFill(draft, '22:30', 30)).toEqual({
      ok: false,
      error: 'Lịch vượt quá 23:59; giảm số phút hoặc giờ bắt đầu.',
    });
  });

  it('báo lỗi giờ từng lượt: sai dạng, kết thúc không sau bắt đầu, chồng lượt trước; liền kề hợp lệ', () => {
    let draft = addSlot(
      addSlot(addSlot(empty, pool('1')), pool('2')),
      pool('3'),
    );
    expect(slotErrors(draft)).toEqual({});
    draft = setSlotTime(draft, '1', 'end', '07:30');
    draft = setSlotTime(draft, '3', 'start', '8h');
    expect(slotErrors(draft)).toEqual({
      '1': 'Giờ kết thúc phải sau giờ bắt đầu.',
      '3': 'Nhập giờ dạng HH:MM, ví dụ 07:30.',
    });
    draft = setSlotTime(draft, '1', 'end', '08:20');
    draft = setSlotTime(draft, '3', 'start', '09:00');
    expect(slotErrors(draft)).toEqual({
      '2': 'Bắt đầu trước khi DT-1 kết thúc.',
    });
  });

  it('kiểm tra trường chung và lý do khi lịch đã công bố', () => {
    expect(
      fieldErrors({
        ...empty,
        name: ' ',
        chairId: '',
        secretaryId: '',
        date: '',
        room: '',
      }),
    ).toEqual({
      name: 'Nhập tên hội đồng.',
      chair: 'Chọn Chủ tịch.',
      secretary: 'Chọn Thư ký.',
      date: 'Chọn ngày bảo vệ.',
      room: 'Nhập phòng bảo vệ.',
    });
    expect(fieldErrors({ ...empty, secretaryId: 'B' }).secretary).toBe(
      'Chủ tịch và Thư ký phải là hai giảng viên khác nhau.',
    );
    expect(fieldErrors({ ...empty, published: true }).reason).toBe(
      'Nhập lý do sửa lịch đã công bố.',
    );
    expect(fieldErrors(empty)).toEqual({});
  });

  it('nhận ra GVHD đang ngồi hội đồng', () => {
    expect(supervisorInCouncil(empty, 'B')).toBe(true);
    expect(supervisorInCouncil(empty, 'C')).toBe(true);
    expect(supervisorInCouncil(empty, 'A')).toBe(false);
  });

  it('dựng body API, gửi phiên bản và lý do khi có', () => {
    const draft = {
      ...addSlot(empty, pool('1')),
      id: 'c1',
      version: 3,
      room: ' B4.12 ',
      reason: ' Đổi phòng ',
    };
    expect(toInput(draft, 'r1')).toEqual({
      roundId: 'r1',
      name: 'Hội đồng 1',
      chairId: 'B',
      secretaryId: 'C',
      date: '2026-10-14',
      room: 'B4.12',
      slots: [{ topicId: '1', start: '07:30', end: '08:15' }],
      expectedVersion: 3,
      reason: 'Đổi phòng',
    });
    expect(toInput(empty, 'r1')).not.toHaveProperty('expectedVersion');
  });

  it('tạo bản nháp mới với tên chưa dùng và ngày đầu mốc bảo vệ', () => {
    const board = {
      round: {
        id: 'r1',
        name: 'Đợt',
        status: 'Đang diễn ra',
        defenseStart: '2026-10-13',
        defenseEnd: '2026-10-18',
      },
      councils: [{ name: 'Hội đồng 2' }],
      pool: [],
      lecturers: [],
      stats: {
        councils: 1,
        total: 0,
        scheduled: 0,
        unscheduled: 0,
        conflicts: 0,
      },
    } as unknown as CouncilBoard;
    expect(newDraft(board)).toMatchObject({
      name: 'Hội đồng 3',
      date: '2026-10-13',
      id: null,
    });
  });

  it('chuyển hội đồng đã lưu thành bản nháp', () => {
    const council = {
      id: 'c1',
      version: 2,
      status: 'Đã công bố',
      name: 'Hội đồng 1',
      chair: person('B'),
      secretary: person('C'),
      date: '2026-10-14',
      room: 'B4.12',
      slots: [
        {
          topicId: '1',
          code: 'DT-1',
          title: 'T',
          group: [],
          supervisor: person('A'),
          reviewer: person('D'),
          start: '07:30',
          end: '08:15',
          thesisVersionCount: 2,
        },
      ],
    } as unknown as Council;
    const draft = draftFromCouncil(council);
    expect(draft).toMatchObject({ published: true, version: 2, chairId: 'B' });
    expect(draft.slots[0]).toMatchObject({
      reviewerName: 'GV D',
      groupText: '—',
      thesisVersionCount: 2,
    });
  });

  it('định dạng ngày và khoảng giờ', () => {
    expect(formatDay('2026-10-14')).toBe('14/10/2026');
    expect(formatDay('')).toBe('—');
    expect(span([])).toBeNull();
    expect(
      span([
        { start: '07:30', end: '08:15' },
        { start: '08:15', end: '09:00' },
      ]),
    ).toBe('07:30–09:00');
  });
});
