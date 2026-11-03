import { expect, it } from 'vitest';
import {
  LECTURER_LOAD_MAX,
  LECTURER_LOAD_MIN,
  avatarInitials,
  countsTowardLoad,
  dateOf,
  formatComponentScore,
  formatScore,
  lecturerLoads,
  loadLevel,
  shortName,
  thesisCell,
  timeOf,
  thesisProgress,
  scoreDeviations,
  totalScore,
} from '@/features/topics/topicUtils';
import { seedTopics } from '@/features/topics/services/topicSeed';
import type { Topic } from '@/types/topic';

const find = (code: string): Topic =>
  seedTopics().find((t) => t.code === code)!;

it('computes the weighted total with two-decimal rounding', () => {
  // (8 + 8,5 + 18 + 17) / 6 = 8,5833...
  expect(totalScore({ CTHĐ: 8, TKHĐ: 8.5, CBHD: 9, CBPB: 8.5 })).toBe(8.58);
  // 50 / 6 = 8,3333...
  expect(totalScore({ CTHĐ: 7, TKHĐ: 8, CBHD: 8.5, CBPB: 9 })).toBe(8.33);
  // 11 / 6 = 1,8333...
  expect(totalScore({ CTHĐ: 0, TKHĐ: 1, CBHD: 2, CBPB: 3 })).toBe(1.83);
  // Hòa ở nửa trăm: (705 + 800 + 1700 + 1700) / 6 = 817,5 → 8,18.
  expect(totalScore({ CTHĐ: 7.05, TKHĐ: 8, CBHD: 8.5, CBPB: 8.5 })).toBe(8.18);
  expect(totalScore({ CTHĐ: 5, TKHĐ: 5, CBHD: 5, CBPB: 5 })).toBe(5);
  expect(totalScore({ CTHĐ: 10, TKHĐ: 10, CBHD: 10, CBPB: 10 })).toBe(10);
});

it('returns null unless all four scores are present', () => {
  expect(totalScore({ CTHĐ: null, TKHĐ: 8, CBHD: 9, CBPB: 8 })).toBeNull();
  expect(totalScore({ CTHĐ: 8, TKHĐ: 8, CBHD: 9, CBPB: null })).toBeNull();
  // 0 là điểm hợp lệ, không phải thiếu.
  expect(totalScore({ CTHĐ: 0, TKHĐ: 0, CBHD: 0, CBPB: 0 })).toBe(0);
});

it('formats scores with a decimal comma', () => {
  expect(formatScore(8.5)).toBe('8,50');
  expect(formatScore(null)).toBe('—');
});

it('classifies the lecturer load against the given min and max', () => {
  expect(loadLevel(7, 2, 6)).toBe('over');
  expect(loadLevel(6, 2, 6)).toBe('ok');
  expect(loadLevel(2, 2, 6)).toBe('ok');
  expect(loadLevel(1, 2, 6)).toBe('below');
});

it('does not warn while the limits are unset (0)', () => {
  expect(LECTURER_LOAD_MIN).toBe(0);
  expect(LECTURER_LOAD_MAX).toBe(0);
  expect(loadLevel(0)).toBe('ok');
  expect(loadLevel(99)).toBe('ok');
});

it('counts GV topics and accepted SV proposals only', () => {
  expect(countsTowardLoad(find('VB1-01'))).toBe(true);
  expect(countsTowardLoad(find('VB1-07'))).toBe(true); // SV đề xuất, đã đăng ký
  expect(countsTowardLoad(find('VB1-11'))).toBe(false); // Chờ GV duyệt
  expect(countsTowardLoad(find('VB1-12'))).toBe(false); // Bị từ chối
  const loads = lecturerLoads(
    seedTopics().filter((t) => t.roundId === 'r-vb1-hk1'),
    ['CB101', 'CB102', 'CB103'],
    { min: 2, max: 6 },
  );
  expect(loads.CB101).toMatchObject({ count: 8, level: 'over' });
  expect(loads.CB102).toMatchObject({ count: 6, level: 'ok' });
  expect(loads.CB103).toMatchObject({ count: 2, level: 'ok' });
});

it('describes thesis progress', () => {
  expect(thesisProgress(find('VB1-01'))).toBe('—'); // Không có nhóm
  expect(thesisProgress(find('VB1-03'))).toBe('Chờ nộp đề cương');
  expect(thesisProgress(find('VB1-04'))).toBe('Giữa kỳ · v2');
  expect(thesisProgress(find('VB1-25-01'))).toBe('Bản khóa luận · v4');
});

it('formats component scores with one decimal, keeping hundredths', () => {
  expect(formatComponentScore(8)).toBe('8,0');
  expect(formatComponentScore(8.5)).toBe('8,5');
  expect(formatComponentScore(7.05)).toBe('7,05');
  expect(formatComponentScore(null)).toBe('—');
});

it('builds the thesis cell, abbreviated names and initials', () => {
  const topics = seedTopics();
  const none = topics.find((t) => t.submissions.length === 0)!;
  expect(thesisCell(none)).toEqual({
    label: 'Chưa nộp',
    sub: 'Chưa có phiên bản',
    tone: 'none',
  });
  const done = topics.find((t) => t.status === 'Đã hoàn tất')!;
  expect(thesisCell(done).label).toBe('Chốt bản cuối');
  expect(thesisCell(done).sub).toBe(`${done.submissions.length} phiên bản`);
  expect(shortName('Nguyễn Văn An')).toBe('N.V. An');
  expect(avatarInitials('TS. Trần Minh Khoa')).toBe('TK');
  expect(avatarInitials('Nguyễn Thị Hương')).toBe('NH');
  expect(dateOf('2026-10-26T08:05:00')).toBe('26/10/2026');
  expect(timeOf('2026-10-26T08:05:00')).toBe('08:05');
});

const sc = (
  CTHĐ: number | null,
  TKHĐ: number | null,
  CBHD: number | null,
  CBPB: number | null,
) => ({ CTHĐ, TKHĐ, CBHD, CBPB });

it('flags a cross pair that differs by exactly 2.0 but not by 1.99', () => {
  const at = scoreDeviations(sc(6, 7, 8, 7));
  expect(at.pairs).toEqual([{ council: 'CTHĐ', lecturer: 'CBHD', diff: 2 }]);
  expect([...at.roles].sort()).toEqual(['CBHD', 'CTHĐ']);
  expect(scoreDeviations(sc(6.01, 7, 8, 7)).pairs).toHaveLength(0);
});

it('skips pairs with a missing score', () => {
  expect(scoreDeviations(sc(5, null, null, 9)).pairs).toEqual([
    { council: 'CTHĐ', lecturer: 'CBPB', diff: 4 },
  ]);
  expect(scoreDeviations(sc(null, null, null, null)).pairs).toHaveLength(0);
});

it('does not count CT-TK or HD-PB differences', () => {
  const r = scoreDeviations(sc(5, 9, 6, 6));
  expect(r.pairs.map((p) => [p.council, p.lecturer])).toEqual([
    ['TKHĐ', 'CBHD'],
    ['TKHĐ', 'CBPB'],
  ]);
  expect(scoreDeviations(sc(7.5, 7.5, 6.5, 8.5)).pairs).toHaveLength(0);
  expect(scoreDeviations(sc(7, 7, 7, 7)).pairs).toHaveLength(0);
});
