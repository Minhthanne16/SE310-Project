import { describe, expect, it } from 'vitest';
import {
  RoundNotFoundError,
  createRoundService,
} from '@/features/rounds/services/roundService';
import { DEMO_TODAY, seedRounds } from '@/features/rounds/services/roundSeed';
import { SEED_PHASES, seedTopics } from '@/features/topics/services/topicSeed';
import {
  TopicNotFoundError,
  TopicRuleError,
  createTopicService,
} from '@/features/topics/services/topicService';
import { TOPIC_STATUSES, type MilestoneKey } from '@/types/round';
import { SCORE_ROLES } from '@/types/topic';

const TODAY = '2026-10-26';
const VB1 = 'r-vb1-hk1';
const THS = 'r-ths-1-2026';
const OLD = 'r-vb1-hk2-2025';

const make = (today = TODAY) => {
  const roundService = createRoundService({ today });
  return {
    roundService,
    service: createTopicService({ today, roundService }),
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
      expect(round.topicSummary.unpublishedCount, round.id).toBe(
        SEED_PHASES[round.id] === 'Đang gửi đề tài' ? mine.length : 0,
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
      'Đã cho điểm',
      'Đã hoàn tất',
    ]);
    for (const t of seedTopics()) {
      if (t.group.length === 0) expect(t.status, t.code).toBe('Chưa đăng ký');
      else if (t.source === 'GV công bố')
        expect(withGroup.has(t.status), t.code).toBe(true);
      // Đề xuất SV luôn có nhóm: Chờ GV duyệt, Bị từ chối hoặc đã chấp nhận.
      else expect(t.group.length, t.code).toBeGreaterThan(0);
    }
  });

  it('keeps GV topics Chưa đăng ký with no group in any unpublished round', () => {
    const topics = seedTopics();
    const unpublished = Object.entries(SEED_PHASES).filter(
      ([, phase]) => phase === 'Đang gửi đề tài',
    );
    expect(unpublished.length).toBeGreaterThan(0);
    for (const [roundId] of unpublished)
      for (const t of topics.filter(
        (x) => x.roundId === roundId && x.source === 'GV công bố',
      )) {
        expect(t.status, t.code).toBe('Chưa đăng ký');
        expect(t.group, t.code).toEqual([]);
      }
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

  it('only has results for topics whose round has reached them', () => {
    const rounds = seedRounds();
    for (const t of seedTopics()) {
      if (t.status !== 'Đã cho điểm' && t.status !== 'Đã hoàn tất') continue;
      expect(rounds.find((r) => r.id === t.roundId)!.status, t.code).toBe(
        'Đã kết thúc',
      );
    }
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
    expect((await s.get('t-vb1-01')).history).toEqual([]);
  });
});

describe('publish', () => {
  it('is blocked until the submission deadline has passed', async () => {
    const early = make('2026-08-14').service; // đúng ngày hết hạn: chưa hết hạn
    expect(await early.roundState(THS)).toMatchObject({
      deadlinePassed: false,
      canPublish: false,
      publishBlockedReason: 'Chưa hết hạn gửi đề tài.',
    });
    await expect(early.publish(THS)).rejects.toBeInstanceOf(TopicRuleError);

    const late = make('2026-08-15').service;
    expect(await late.roundState(THS)).toMatchObject({
      deadlinePassed: true,
      canPublish: true,
      phase: 'Đang gửi đề tài',
    });
  });

  it('leaves Thạc sĩ publishable and VB1 already published at the demo date', async () => {
    const { service: s } = make();
    expect(await s.roundState(THS)).toMatchObject({
      canPublish: true,
      phase: 'Đang gửi đề tài',
      roundStatus: 'Đang diễn ra',
    });
    expect(await s.roundState(VB1)).toMatchObject({
      canPublish: false,
      phase: 'Đã công bố danh sách',
      publishBlockedReason: 'Danh sách đã được công bố.',
    });
    await expect(s.publish(VB1)).rejects.toThrow('đã được công bố');
  });

  it('publishes once, cannot be undone and updates the round summary', async () => {
    const { service: s, roundService } = make();
    expect((await roundService.get(THS)).topicSummary.unpublishedCount).toBe(6);
    const state = await s.publish(THS);
    expect(state.phase).toBe('Đã công bố danh sách');
    expect(state.canPublish).toBe(false);
    expect((await s.list({ roundId: THS })).round.phase).toBe(
      'Đã công bố danh sách',
    );
    expect((await roundService.get(THS)).topicSummary.unpublishedCount).toBe(0);
    await expect(s.publish(THS)).rejects.toThrow('đã được công bố');
    // Đợt khác không bị ảnh hưởng.
    expect((await s.roundState(OLD)).phase).toBe('Đã công bố danh sách');
  });

  it('refuses rounds that are not running or have no topics', async () => {
    const { service: s, roundService } = make();
    await expect(s.publish('r-vb2-hk2-nhap')).rejects.toBeInstanceOf(
      TopicRuleError,
    );
    const empty = createTopicService({
      today: TODAY,
      roundService,
      topics: [],
    });
    expect((await empty.roundState(THS)).publishBlockedReason).toBe(
      'Chưa có đề tài để công bố.',
    );
  });
});

describe('exportCsv', () => {
  it('exports the filtered list', async () => {
    const result = await make().service.exportCsv({
      roundId: VB1,
      supervisorId: 'CB103',
    });
    expect(result.count).toBe(2);
    expect(result.csv.split('\r\n')).toHaveLength(4);
    expect(result.csv).toContain('VB1-17');
    expect(result.csv).not.toContain('VB1-01');
  });

  it('reports zero rows for an empty list', async () => {
    const result = await make().service.exportCsv({
      roundId: 'r-vb2-hk2-nhap',
    });
    expect(result.count).toBe(0);
  });
});
