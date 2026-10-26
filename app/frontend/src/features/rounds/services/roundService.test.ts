import { describe, expect, it } from 'vitest';
import {
  DuplicateRoundNameError,
  MilestoneOrderError,
  RoundNotFoundError,
  RoundRuleError,
  RoundValidationError,
  createRoundService,
} from './roundService';

const TODAY = '2026-10-26';
const svc = () => createRoundService({ today: TODAY });

describe('list and get', () => {
  it('filters by status, program and name', async () => {
    const s = svc();
    const running = await s.list({ status: 'Đang diễn ra' });
    expect(running).toHaveLength(3);
    expect((await s.list({ status: 'Tất cả' })).length).toBe(5);
    expect(
      (await s.list({ status: 'Tất cả', program: 'Thạc sĩ' })).map(
        (r) => r.name,
      ),
    ).toEqual(['Thạc sĩ · Đợt 1/2026']);
    expect(
      await s.list({ status: 'Tất cả', search: '  hk2 2025 ' }),
    ).toHaveLength(1);
  });

  it('has nine milestones per round and throws for an unknown id', async () => {
    const s = svc();
    for (const r of await s.list({ status: 'Tất cả' }))
      expect(r.milestones).toHaveLength(9);
    await expect(s.get('khong-co')).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});

describe('create', () => {
  it('requires name, program and period', async () => {
    const s = svc();
    const err = await s
      .create({ name: '  ', program: '', periodLabel: '' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoundValidationError);
    expect((err as RoundValidationError).fields).toEqual({
      name: 'Nhập tên đợt.',
      program: 'Chọn chương trình.',
      periodLabel: 'Nhập học kỳ hoặc khóa.',
    });
  });

  it('rejects a duplicate name ignoring case and spaces', async () => {
    const s = svc();
    await expect(
      s.create({
        name: '  thạc sĩ · đợt 1/2026 ',
        program: 'Thạc sĩ',
        periodLabel: 'Đợt 2/2026',
      }),
    ).rejects.toBeInstanceOf(DuplicateRoundNameError);
  });

  it('creates a draft with empty dates', async () => {
    const s = svc();
    const round = await s.create({
      name: 'Văn bằng 1 · HK2 2026–2027',
      program: 'Văn bằng 1',
      periodLabel: 'HK2 2026–2027',
    });
    expect(round.status).toBe('Nháp');
    expect(round.milestones.every((m) => m.startDate === '')).toBe(true);
    expect(round.milestones.find((m) => m.key === 'outline')?.allowLate).toBe(
      true,
    );
    expect(round.milestones.find((m) => m.key === 'grading')?.allowLate).toBe(
      null,
    );
    expect(await s.get(round.id)).toEqual(round);
  });

  it('copies settings and lecturers from an old round, not dates or students', async () => {
    const s = svc();
    const source = await s.get('r-vb1-hk1');
    const round = await s.create({
      name: 'Bản sao',
      program: 'Văn bằng 1',
      periodLabel: 'HK2 2026–2027',
      copyFromId: source.id,
    });
    expect(round.lecturerIds).toEqual(source.lecturerIds);
    expect(round.studentIds).toEqual([]);
    expect(round.milestones.every((m) => m.startDate === '')).toBe(true);
    expect(round.milestones[0].notifyAudience).toBe('Giảng viên');
    await expect(
      s.create({
        name: 'Bản sao 2',
        program: 'Văn bằng 1',
        periodLabel: 'x',
        copyFromId: 'khong-co',
      }),
    ).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});

describe('open, finish, remove', () => {
  it('opens only a draft and finishes only a running round', async () => {
    const s = svc();
    await expect(s.open('r-vb1-hk1')).rejects.toBeInstanceOf(RoundRuleError);
    await expect(s.finish('r-vb2-hk2-nhap')).rejects.toBeInstanceOf(
      RoundRuleError,
    );
    const opened = await s.open('r-vb2-hk2-nhap');
    expect(opened.status).toBe('Đang diễn ra');
    expect((await s.finish('r-vb2-hk2-nhap')).status).toBe('Đã kết thúc');
    await expect(s.finish('r-vb2-hk2-nhap')).rejects.toBeInstanceOf(
      RoundRuleError,
    );
  });

  it('opens a draft even when setup is incomplete', async () => {
    const s = svc();
    const draft = await s.get('r-vb2-hk2-nhap');
    expect(draft.milestones.filter((m) => !m.startDate).length).toBeGreaterThan(
      0,
    );
    expect((await s.open(draft.id)).status).toBe('Đang diễn ra');
  });

  it('removes only drafts', async () => {
    const s = svc();
    await expect(s.remove('r-vb1-hk1')).rejects.toBeInstanceOf(RoundRuleError);
    await expect(s.remove('r-vb1-hk2-2025')).rejects.toBeInstanceOf(
      RoundRuleError,
    );
    await s.remove('r-vb2-hk2-nhap');
    await expect(s.get('r-vb2-hk2-nhap')).rejects.toBeInstanceOf(
      RoundNotFoundError,
    );
  });

  it('refuses to open a draft whose student already runs in another round', async () => {
    const s = svc();
    const other = await s.create({
      name: 'Đợt nháp khác',
      program: 'Văn bằng 2',
      periodLabel: 'HK2 2026–2027',
    });
    await s.addParticipants('r-vb2-hk2-nhap', 'student', ['22520010']);
    // Cả hai đều Nháp nên thêm được; mở đợt thứ hai sẽ vi phạm quy tắc.
    await s.addParticipants(other.id, 'student', ['22520010']);
    await s.open('r-vb2-hk2-nhap');
    const err = await s.open(other.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoundRuleError);
    expect((err as Error).message).toMatch(/22520010/);
    expect((await s.get(other.id)).status).toBe('Nháp');
  });
});

describe('milestones', () => {
  it('saves a valid configuration', async () => {
    const s = svc();
    const round = await s.get('r-vb2-hk2-nhap');
    const next = round.milestones.map((m) =>
      m.key === 'outline'
        ? {
            ...m,
            startDate: '2027-03-01',
            endDate: '2027-03-12',
            allowLate: false,
          }
        : m,
    );
    const saved = await s.updateMilestones(round.id, next);
    const outline = saved.milestones.find((m) => m.key === 'outline');
    expect(outline).toMatchObject({
      startDate: '2027-03-01',
      allowLate: false,
    });
  });

  it('rejects a milestone that ends before it starts', async () => {
    const s = svc();
    const round = await s.get('r-vb2-hk2-nhap');
    const next = round.milestones.map((m) =>
      m.key === 'outline'
        ? { ...m, startDate: '2027-03-12', endDate: '2027-03-01' }
        : m,
    );
    const err = await s
      .updateMilestones(round.id, next)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MilestoneOrderError);
    expect((err as MilestoneOrderError).errors.outline).toMatch(
      /sau hoặc cùng/,
    );
  });

  it('rejects milestones that start out of order', async () => {
    const s = svc();
    const round = await s.get('r-vb1-hk1');
    const next = round.milestones.map((m) =>
      m.key === 'midterm'
        ? { ...m, startDate: '2026-09-01', endDate: '2026-09-05' }
        : m,
    );
    const err = await s
      .updateMilestones(round.id, next)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MilestoneOrderError);
    expect((err as MilestoneOrderError).errors.midterm).toMatch(/Đề cương/);
    // Không ghi gì khi lỗi.
    expect(
      (await s.get(round.id)).milestones.find((m) => m.key === 'midterm')
        ?.startDate,
    ).toBe('2026-10-19');
  });

  it('does not edit a finished round', async () => {
    const s = svc();
    const round = await s.get('r-vb1-hk2-2025');
    await expect(
      s.updateMilestones(round.id, round.milestones),
    ).rejects.toBeInstanceOf(RoundRuleError);
  });
});

describe('participants', () => {
  it('checks each code and adds only the valid ones', async () => {
    const s = svc();
    const id = 'r-vb2-hk1';
    const results = await s.checkParticipants(id, 'student', [
      '22520010',
      '99999999',
      '22520001',
      '22520010',
    ]);
    expect(results.map((r) => [r.code, r.status])).toEqual([
      ['22520010', 'valid'],
      ['99999999', 'notFound'],
      ['22520001', 'inOtherRound'],
    ]);
    const outcome = await s.addParticipants(id, 'student', [
      '22520010',
      '99999999',
    ]);
    expect(outcome.added).toBe(1);
    expect(outcome.round.studentIds).toContain('22520010');
    const again = await s.checkParticipants(id, 'student', ['22520010']);
    expect(again[0].status).toBe('alreadyInRound');
  });

  it('lets a lecturer join several rounds and marks blocked students as candidates', async () => {
    const s = svc();
    const id = 'r-vb2-hk2-nhap';
    expect(
      (await s.checkParticipants(id, 'lecturer', ['cb101']))[0].status,
    ).toBe('valid');
    const students = await s.listCandidates('r-vb2-hk1', 'student');
    expect(students.find((c) => c.code === '22520001')?.blockedReason).toMatch(
      /Văn bằng 1 · HK1/,
    );
    expect(students.find((c) => c.code === '22520010')?.blockedReason).toBe(
      undefined,
    );
    const lecturers = await s.listCandidates(id, 'lecturer');
    expect(lecturers.some((c) => c.code === 'CB103')).toBe(false);
  });

  it('rejects a student who is in another running round', async () => {
    const s = svc();
    const outcome = await s.addParticipants('r-vb2-hk1', 'student', [
      '22520001',
    ]);
    expect(outcome.added).toBe(0);
    expect(outcome.results[0].status).toBe('inOtherRound');
  });

  it('lets a draft take a student of a running round, and only open() enforces the rule', async () => {
    const s = svc();
    const draft = 'r-vb2-hk2-nhap';
    const students = await s.listCandidates(draft, 'student');
    expect(students.every((c) => !c.blockedReason)).toBe(true);
    const outcome = await s.addParticipants(draft, 'student', ['22520001']);
    expect(outcome.added).toBe(1);
    const err = await s.open(draft).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoundRuleError);
    // Báo mã và họ tên, không báo id nội bộ.
    expect((err as Error).message).toContain('22520001 (Nguyễn Văn An)');
  });

  it('allows a student of a finished round into a new round', async () => {
    const s = svc();
    const outcome = await s.addParticipants('r-vb2-hk2-nhap', 'student', [
      '22520011',
    ]);
    expect(outcome.added).toBe(1);
  });

  it('blocks removing a student who has data in this round, with a reason', async () => {
    const s = svc();
    const err = await s
      .removeParticipant('r-vb1-hk1', 'student', '22520001')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoundRuleError);
    expect((err as Error).message).toMatch(/đã có dữ liệu/);
    expect((await s.get('r-vb1-hk1')).studentIds).toContain('22520001');

    const round = await s.removeParticipant('r-vb1-hk1', 'student', '22520002');
    expect(round.studentIds).not.toContain('22520002');
  });

  it('does not lock lecturers, and data does not follow a person into a copied round', async () => {
    const s = svc();
    // CB101 đã có dữ liệu ở đợt cũ nhưng gỡ được khỏi đợt này.
    const round = await s.removeParticipant('r-vb1-hk1', 'lecturer', 'CB101');
    expect(round.lecturerIds).not.toContain('CB101');

    const copy = await s.create({
      name: 'Bản sao để gỡ',
      program: 'Văn bằng 1',
      periodLabel: 'HK2 2026–2027',
      copyFromId: 'r-ths-1-2026',
    });
    expect(copy.lecturerIds).toContain('CB101');
    const afterLecturer = await s.removeParticipant(
      copy.id,
      'lecturer',
      'CB101',
    );
    expect(afterLecturer.lecturerIds).not.toContain('CB101');

    // Sinh viên có dữ liệu ở đợt khác vẫn gỡ được khỏi đợt mới này.
    await s.addParticipants(copy.id, 'student', ['22520010']);
    const afterStudent = await s.removeParticipant(
      copy.id,
      'student',
      '22520010',
    );
    expect(afterStudent.studentIds).toEqual([]);
  });
});

describe('notifications', () => {
  it('filters by source, searches title or sender and limits', async () => {
    const s = svc();
    const all = await s.listNotifications({ roundId: 'r-vb1-hk1' });
    expect(all.total).toBe(7);
    expect(all.items[0].createdAt >= all.items[1].createdAt).toBe(true);

    const mine = await s.listNotifications({
      roundId: 'r-vb1-hk1',
      source: 'mine',
    });
    expect(mine.items.every((n) => n.mine)).toBe(true);

    const giaovu = await s.listNotifications({
      roundId: 'r-vb1-hk1',
      source: 'giaovu',
    });
    expect(giaovu.items.every((n) => n.source === 'Từ giáo vụ')).toBe(true);
    expect(giaovu.total).toBeLessThan(all.total);

    const bySender = await s.listNotifications({
      roundId: 'r-vb1-hk1',
      search: 'hương',
    });
    expect(bySender.items.map((n) => n.id)).toEqual(['n-03']);

    const limited = await s.listNotifications({
      roundId: 'r-vb1-hk1',
      limit: 2,
    });
    expect(limited.items).toHaveLength(2);
    expect(limited.total).toBe(7);
  });
});
