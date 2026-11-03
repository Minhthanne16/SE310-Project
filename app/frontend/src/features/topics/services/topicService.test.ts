import { describe, expect, it } from 'vitest';
import {
  RoundNotFoundError,
  createRoundService,
} from '@/features/rounds/services/roundService';
import { DEMO_TODAY, seedRounds } from '@/features/rounds/services/roundSeed';
import { seedTopics } from '@/features/topics/services/topicSeed';
import {
  TopicNotFoundError,
  createTopicService,
} from '@/features/topics/services/topicService';
import {
  TOPIC_STATUSES,
  isSettledTopicStatus,
  type MilestoneKey,
} from '@/types/round';
import { gradingStatus } from '@/features/topics/topicUtils';
import { SCORE_ROLES } from '@/types/topic';

const TODAY = '2026-10-26';
const VB1 = 'r-vb1-hk1';
const THS = 'r-ths-1-2026';
const OLD = 'r-vb1-hk2-2025';

const make = (today = TODAY) => {
  const roundService = createRoundService({ today });
  return {
    roundService,
    service: createTopicService({
      today,
      roundService,
      loadLimits: { min: 2, max: 6 },
    }),
  };
};

describe('seed data', () => {
  it('covers every status across rounds with one to two students per group', () => {
    const topics = seedTopics();
    expect(new Set(topics.map((t) => t.status))).toEqual(
      new Set(TOPIC_STATUSES),
    );
    const vb1 = topics.filter((t) => t.roundId === VB1);
    expect(vb1.length).toBeGreaterThanOrEqual(15);
    expect(vb1.length).toBeLessThanOrEqual(20);
    for (const t of topics) {
      expect(t.group.length).toBeLessThanOrEqual(2);
      if (t.group.length > 0)
        expect(t.group.filter((m) => m.representative)).toHaveLength(1);
    }
  });

  it('keeps round topicSummary in sync with the topic store', () => {
    const topics = seedTopics();
    for (const round of seedRounds()) {
      const mine = topics.filter((t) => t.roundId === round.id);
      expect(round.topicSummary.total, round.id).toBe(mine.length);
      for (const status of TOPIC_STATUSES)
        expect(
          round.topicSummary.byStatus[status],
          `${round.id} ${status}`,
        ).toBe(mine.filter((t) => t.status === status).length);
      // Đợt đã kết thúc không còn đề tài chờ kết quả (PDR-031).
      expect(round.topicSummary.pendingResultCount, round.id).toBe(
        round.status === 'Đã kết thúc'
          ? 0
          : mine.filter((t) => !isSettledTopicStatus(t.status)).length,
      );
    }
  });

  it('locks exactly the students that have data (any group member) in each round', () => {
    const topics = seedTopics();
    for (const round of seedRounds()) {
      const withData = new Set<string>();
      for (const t of topics.filter((x) => x.roundId === round.id)) {
        for (const m of t.group) withData.add(m.id);
        for (const s of t.scores) withData.add(s.studentId);
      }
      expect(new Set(round.lockedStudentIds), round.id).toEqual(withData);
    }
  });

  it('keeps group members inside the round and in one group only', () => {
    const rounds = seedRounds();
    const seen = new Set<string>();
    for (const t of seedTopics()) {
      const round = rounds.find((r) => r.id === t.roundId)!;
      expect(round.lecturerIds).toContain(t.supervisor.id);
      for (const m of t.group) {
        expect(round.studentIds, t.code).toContain(m.id);
        if (t.status !== 'Bị từ chối') {
          expect(seen.has(m.id), `${t.code} ${m.id}`).toBe(false);
          seen.add(m.id);
        }
      }
    }
  });

  it('has GVHD different from GVPB, both belonging to the round', () => {
    const rounds = seedRounds();
    for (const t of seedTopics()) {
      const round = rounds.find((r) => r.id === t.roundId)!;
      if (!t.reviewer) continue;
      expect(t.reviewer.id, t.code).not.toBe(t.supervisor.id);
      expect(round.lecturerIds, t.code).toContain(t.reviewer.id);
    }
  });

  it('only gives groups to statuses that allow them', () => {
    const withGroup = new Set([
      'Đã đăng ký',
      'Đang thực hiện',
      'Đang cho điểm',
      'Đã cho điểm',
      'Có lệch điểm',
      'Đã xác nhận',
      'Đã hoàn tất',
      'Không đủ điều kiện công bố',
    ]);
    for (const t of seedTopics()) {
      if (t.group.length === 0)
        expect(['Chưa đăng ký', 'Không có nhóm'], t.code).toContain(t.status);
      else if (t.source === 'GV công bố')
        expect(withGroup.has(t.status), t.code).toBe(true);
      // Đề xuất SV luôn có nhóm: Chờ GV duyệt, Bị từ chối hoặc đã chấp nhận.
      else expect(t.group.length, t.code).toBeGreaterThan(0);
    }
  });

  it('keeps GV topics Chưa đăng ký with no group in any unpublished round', () => {
    const topics = seedTopics();
    const unpublished = seedRounds().filter(
      (r) => r.status === 'Đang diễn ra' && r.topicsPublishedAt === null,
    );
    expect(unpublished.length).toBeGreaterThan(0);
    for (const round of unpublished)
      for (const t of topics.filter(
        (x) => x.roundId === round.id && x.source === 'GV công bố',
      )) {
        expect(t.status, t.code).toBe('Chưa đăng ký');
        expect(t.group, t.code).toEqual([]);
      }
  });

  it('turns GV topics without a group into Không có nhóm once registration has closed', () => {
    const topics = seedTopics();
    const closed = seedRounds().filter(
      (r) =>
        r.topicsPublishedAt !== null &&
        r.milestones.find((m) => m.key === 'topicRegistration')!.endDate <
          DEMO_TODAY,
    );
    expect(closed.length).toBeGreaterThan(0);
    for (const round of closed)
      for (const t of topics.filter(
        (x) =>
          x.roundId === round.id &&
          x.source === 'GV công bố' &&
          x.group.length === 0,
      ))
        expect(t.status, t.code).toBe('Không có nhóm');
  });

  it('has a Không đủ điều kiện công bố and a Không có nhóm topic in the finished round', () => {
    const mine = seedTopics().filter((t) => t.roundId === OLD);
    expect(
      mine.filter((t) => t.status === 'Không đủ điều kiện công bố'),
    ).toHaveLength(1);
    expect(mine.filter((t) => t.status === 'Không có nhóm')).toHaveLength(1);
    // Không đủ điều kiện công bố: nhóm chưa từng nộp bản khóa luận.
    const ineligible = mine.find(
      (t) => t.status === 'Không đủ điều kiện công bố',
    )!;
    expect(ineligible.group.length).toBeGreaterThan(0);
    expect(
      ineligible.submissions.some(
        (x) => x.kind === 'Bản khóa luận' || x.kind === 'Cuối kỳ',
      ),
    ).toBe(false);
  });

  it('has no event after the demo date and keeps the Nháp round without topics', () => {
    const topics = seedTopics();
    for (const t of topics) {
      for (const h of t.history)
        expect(h.at.slice(0, 10) <= DEMO_TODAY, `${t.code} ${h.at}`).toBe(true);
      for (const s of t.submissions)
        expect(s.submittedAt.slice(0, 10) <= DEMO_TODAY, t.code).toBe(true);
    }
    expect(topics.some((t) => t.roundId === 'r-vb2-hk2-nhap')).toBe(false);
  });

  // Đề tài VB1-16 minh họa nhóm đã chốt bản cuối để công bố được (PDR-049): bản
  // Cuối kỳ nộp sớm hơn cửa sổ mốc của đợt đang diễn ra.
  const EARLY_FINAL_DEMO = new Set(['VB1-16']);

  it('puts submissions inside their milestone window (late ones after it)', () => {
    const rounds = seedRounds();
    const key: Record<string, MilestoneKey> = {
      'Đề cương': 'outline',
      'Giữa kỳ': 'midterm',
      'Cuối kỳ': 'final',
      'Bản khóa luận': 'final',
    };
    for (const t of seedTopics()) {
      const round = rounds.find((r) => r.id === t.roundId)!;
      for (const s of t.submissions) {
        if (EARLY_FINAL_DEMO.has(t.code) && s.kind === 'Cuối kỳ') continue;
        const m = round.milestones.find((x) => x.key === key[s.kind])!;
        const day = s.submittedAt.slice(0, 10);
        if (s.late)
          expect(day > m.endDate, `${t.code} v${s.versionNo}`).toBe(true);
        else
          expect(
            day >= m.startDate && day <= m.endDate,
            `${t.code} v${s.versionNo} ${day}`,
          ).toBe(true);
      }
    }
  });

  it('only has completed results in the finished round; VB1 demos the grading states', () => {
    const rounds = seedRounds();
    for (const t of seedTopics()) {
      if (t.status === 'Đã hoàn tất')
        expect(rounds.find((r) => r.id === t.roundId)!.status, t.code).toBe(
          'Đã kết thúc',
        );
      // Trạng thái chấm điểm chỉ ở đợt đã kết thúc hoặc VB1 (dữ liệu minh họa
      // PDR-049, mọi phiếu đã nhập trước ngày demo).
      if (
        [
          'Đang cho điểm',
          'Đã cho điểm',
          'Có lệch điểm',
          'Đã xác nhận',
        ].includes(t.status)
      )
        expect([VB1, OLD], t.code).toContain(t.roundId);
    }
  });

  it('derives every stored grading status from the score sheets', () => {
    for (const t of seedTopics())
      if (['Đang cho điểm', 'Đã cho điểm', 'Có lệch điểm'].includes(t.status))
        expect(gradingStatus(t), t.code).toBe(t.status);
  });
});

describe('list and filters', () => {
  it('filters by supervisor, status and search; sorted by code', async () => {
    const { service: s } = make();
    const all = await s.list({ roundId: VB1 });
    expect(all.roundTotal).toBe(18);
    const codes = all.items.map((t) => t.code);
    expect(codes).toEqual(codes.toSorted());
    const bySup = await s.list({ roundId: VB1, supervisorId: 'CB103' });
    expect(bySup.items.map((t) => t.code)).toEqual(['VB1-17', 'VB1-18']);
    expect(bySup.roundTotal).toBe(18);
    const byStatus = await s.list({ roundId: VB1, status: 'Bị từ chối' });
    expect(byStatus.items.map((t) => t.code)).toEqual(['VB1-12']);
    expect(
      (await s.list({ roundId: VB1, status: 'Tất cả' })).items,
    ).toHaveLength(18);
    expect(
      (await s.list({ roundId: VB1, search: ' chatbot ' })).items.map(
        (t) => t.code,
      ),
    ).toEqual(['VB1-04']);
    expect((await s.list({ roundId: VB1, search: 'vb1-1' })).items.length).toBe(
      9,
    );
    expect(
      (await s.list({ roundId: VB1, search: 'không có đề tài này' })).items,
    ).toEqual([]);
  });

  it('returns nothing for the draft round and throws for an unknown round', async () => {
    const { service: s } = make();
    const draft = await s.list({ roundId: 'r-vb2-hk2-nhap' });
    expect(draft.items).toEqual([]);
    expect(draft.roundTotal).toBe(0);
    await expect(s.list({ roundId: 'khong-co' })).rejects.toBeInstanceOf(
      RoundNotFoundError,
    );
  });

  it('computes lecturer load over the whole round, ignoring filters', async () => {
    const result = await make().service.list({
      roundId: VB1,
      supervisorId: 'CB103',
    });
    expect(result.loads.CB101).toMatchObject({ count: 8, level: 'over' });
    expect(result.loads.CB102.level).toBe('ok');
  });

  it('returns copies so callers cannot mutate the store', async () => {
    const { service: s } = make();
    const { items } = await s.list({ roundId: VB1 });
    items[0].title = 'đã sửa';
    expect((await s.list({ roundId: VB1 })).items[0].title).not.toBe('đã sửa');
  });

  it('lists the round lecturers as supervisors', async () => {
    expect(
      (await make().service.listSupervisors(VB1)).map((p) => p.id),
    ).toEqual(['CB101', 'CB102', 'CB103']);
  });
});

describe('get', () => {
  it('returns a topic and throws TopicNotFoundError otherwise', async () => {
    const { service: s } = make();
    expect((await s.get('t-vb1-06')).code).toBe('VB1-06');
    await expect(s.get('khong-co')).rejects.toBeInstanceOf(TopicNotFoundError);
  });

  it('has history newest first and complete scores for completed topics', async () => {
    const { service: s } = make();
    const t = await s.get('t-vb1-25-01');
    const times = t.history.map((h) => h.at);
    expect(times).toEqual(times.toSorted().toReversed());
    for (const row of t.scores)
      for (const role of SCORE_ROLES) expect(row.scores[role]).not.toBeNull();
    // Chưa đăng ký (chưa công bố): chưa có sự kiện nào cần truy vết.
    expect((await s.get('t-ths-01')).history).toEqual([]);
    const noGroup = await s.get('t-vb1-01');
    expect(noGroup.status).toBe('Không có nhóm');
    expect(noGroup.history).toHaveLength(1);
  });
});

describe('roundState', () => {
  it('returns the round name and status, and throws for an unknown round', async () => {
    const { service: s } = make();
    expect(await s.roundState(THS)).toEqual({
      roundId: THS,
      roundName: 'Thạc sĩ · Đợt 1/2026',
      roundStatus: 'Đang diễn ra',
    });
    await expect(s.roundState('khong-co')).rejects.toBeInstanceOf(
      RoundNotFoundError,
    );
  });
});

describe('results (PDR-049)', () => {
  const idOf = (code: string) => `t-${code.toLowerCase()}`;
  // Sau hạn "Chốt bản cuối · công bố" của VB1 (15/01/2027).
  const AFTER_LOCK = '2027-02-01';

  it('confirms a whole group only when it is Đã cho điểm, and logs it', async () => {
    const { service: s } = make();
    const [out] = await s.confirmResults([idOf('VB1-08')]);
    expect(out).toMatchObject({ ok: true, code: 'VB1-08' });
    const t = await s.get(idOf('VB1-08'));
    expect(t.status).toBe('Đã xác nhận');
    expect(t.history[0]).toMatchObject({
      actor: 'Giáo vụ',
      category: 'Trạng thái',
      action: 'Xác nhận kết quả',
    });
  });

  it('blocks confirming deviating, incomplete, already confirmed and unknown topics', async () => {
    const { service: s } = make();
    const out = await s.confirmResults([
      idOf('VB1-13'),
      idOf('VB1-06'),
      idOf('VB1-16'),
      idOf('VB1-04'),
      'khong-co',
    ]);
    expect(out.map((o) => o.ok)).toEqual([false, false, false, false, false]);
    expect(out[0].message).toContain('Còn cặp điểm lệch từ 2 điểm');
    expect(out[1].message).toContain('Chưa đủ điểm');
    expect(out[2].message).toContain('Đã xác nhận rồi');
    expect(out[3].message).toContain('Chưa có điểm');
    expect(out[4].message).toContain('không tìm thấy');
    expect((await s.get(idOf('VB1-13'))).status).toBe('Có lệch điểm');
  });

  it('re-derives the status instead of trusting the stored one', async () => {
    const stale = seedTopics().map((t) =>
      t.code === 'VB1-13' ? { ...t, status: 'Đã cho điểm' as const } : t,
    );
    const roundService = createRoundService({ today: TODAY });
    const s = createTopicService({ today: TODAY, roundService, topics: stale });
    const [out] = await s.confirmResults([idOf('VB1-13')]);
    expect(out.ok).toBe(false);
  });

  it('reports each topic of a mixed batch and handles duplicates once', async () => {
    const { service: s } = make();
    const out = await s.confirmResults([
      idOf('VB1-08'),
      idOf('VB1-13'),
      idOf('VB1-08'),
    ]);
    expect(out).toHaveLength(2);
    expect(out.filter((o) => o.ok)).toHaveLength(1);
    expect(out.find((o) => !o.ok)!.code).toBe('VB1-13');
  });

  it('requires a reason to unconfirm, then returns the group to Đã cho điểm', async () => {
    const { service: s } = make();
    const blank = await s.unconfirmResult(idOf('VB1-15'), '   ');
    expect(blank).toMatchObject({ ok: false });
    expect(blank.message).toContain('lý do');
    expect((await s.get(idOf('VB1-15'))).status).toBe('Đã xác nhận');

    const done = await s.unconfirmResult(idOf('VB1-15'), ' Sai điểm CBPB ');
    expect(done.ok).toBe(true);
    const t = await s.get(idOf('VB1-15'));
    expect(t.status).toBe('Đã cho điểm');
    expect(t.history[0]).toMatchObject({
      action: 'Hủy xác nhận kết quả',
      detail: 'Lý do: Sai điểm CBPB',
    });
    // Chỉ hủy được đề tài Đã xác nhận.
    expect((await s.unconfirmResult(idOf('VB1-08'), 'x')).ok).toBe(false);
  });

  it('publishes only confirmed topics with a final lock or past the lock deadline', async () => {
    const { service: s } = make();
    const out = await s.publishResults([
      idOf('VB1-16'),
      idOf('VB1-15'),
      idOf('VB1-08'),
    ]);
    expect(out.map((o) => [o.code, o.ok])).toEqual([
      ['VB1-16', true],
      ['VB1-15', false],
      ['VB1-08', false],
    ]);
    expect(out[1].message).toContain('chưa chốt bản cuối');
    expect(out[2].message).toContain('Chưa xác nhận kết quả');
    expect((await s.get(idOf('VB1-16'))).status).toBe('Đã hoàn tất');
    expect((await s.get(idOf('VB1-15'))).status).toBe('Đã xác nhận');

    const late = await s.publishResults([idOf('VB1-15')], AFTER_LOCK);
    expect(late[0].ok).toBe(true);
    expect((await s.get(idOf('VB1-15'))).history[0].action).toBe(
      'Công bố kết quả',
    );
    // Đã hoàn tất không công bố lại, không hủy xác nhận.
    expect((await s.publishResults([idOf('VB1-16')]))[0].ok).toBe(false);
    expect((await s.unconfirmResult(idOf('VB1-16'), 'x')).ok).toBe(false);
  });

  it('reminds only the lecturers of deviating groups and logs it', async () => {
    const { service: s } = make();
    const out = await s.remindDeviations(
      [idOf('VB1-13'), idOf('VB1-08')],
      'Xin xem lại phiếu.',
    );
    expect(out[0].ok).toBe(true);
    expect(out[0].message).toContain('Đã gửi nhắc cho');
    expect(out[1]).toMatchObject({ ok: false });
    expect(out[1].message).toContain('Không có cặp điểm lệch');
    const t = await s.get(idOf('VB1-13'));
    expect(t.history[0]).toMatchObject({
      category: 'Điểm',
      action: 'Gửi nhắc lệch điểm',
    });
    expect(t.history[0].detail).toContain('Xin xem lại phiếu.');
    expect(t.history[0].detail).not.toContain(t.group[0].name);
  });
});
