import { describe, expect, it } from 'vitest';
import {
  currentMilestone,
  currentWeek,
  deriveTasks,
  finishWarning,
  formatDate,
  milestoneProgress,
  milestoneStatus,
  roundSpan,
  setupWarnings,
  validateMilestones,
  weekOf,
} from './roundUtils';
import { buildMilestones, seedRounds } from './services/roundSeed';

const TODAY = '2026-10-26';
const round = (id: string) => {
  const found = seedRounds().find((r) => r.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('milestone status and weeks', () => {
  it('derives past, running and upcoming from today', () => {
    const ms = round('r-vb1-hk1').milestones;
    expect(ms.map((m) => milestoneStatus(m, TODAY))).toEqual([
      'Đã qua',
      'Đã qua',
      'Đã qua',
      'Đang diễn ra',
      'Sắp tới',
      'Sắp tới',
      'Sắp tới',
      'Sắp tới',
      'Sắp tới',
    ]);
    expect(currentMilestone(round('r-vb1-hk1'), TODAY)?.name).toBe(
      'Báo cáo giữa kỳ',
    );
    expect(milestoneProgress(ms[3], TODAY)).toBe(67);
  });

  it('numbers weeks from the Monday of the earliest milestone', () => {
    const r = round('r-vb1-hk1');
    const span = roundSpan(r.milestones);
    expect(span).toEqual({ start: '2026-09-07', weeks: 19 });
    expect(weekOf(span!, '2026-09-07')).toBe(1);
    expect(currentWeek(r, TODAY)).toBe(8);
    expect(currentWeek(r, '2025-01-01')).toBeNull();
    expect(roundSpan(buildMilestones([]))).toBeNull();
  });

  it('formats dates', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatDate('')).toBe('Chưa đặt');
  });
});

describe('validateMilestones', () => {
  it('accepts the seeded configuration and blank milestones', () => {
    for (const r of seedRounds())
      expect(validateMilestones(r.milestones)).toEqual({});
  });

  it('flags half-filled, reversed and out-of-order milestones', () => {
    const ms = round('r-vb1-hk1').milestones.map((m) => ({ ...m }));
    ms[0].endDate = '';
    ms[1].startDate = '2026-10-10';
    ms[1].endDate = '2026-10-01';
    ms[2].startDate = '2026-08-01';
    ms[2].endDate = '2026-08-10';
    const errors = validateMilestones(ms);
    expect(errors.topicSubmission).toMatch(/Nhập đủ/);
    expect(errors.topicRegistration).toMatch(/sau hoặc cùng/);
    // Mốc 2 lỗi nên mốc 3 so với mốc 1 (còn thiếu ngày) là mốc đầu tiên hợp lệ.
    expect(errors.outline).toBeUndefined();
    ms[3].startDate = '2026-07-01';
    ms[3].endDate = '2026-07-02';
    expect(validateMilestones(ms).midterm).toMatch(/Đề cương/);
  });
});

describe('warnings and tasks', () => {
  it('lists unfinished setup of a draft', () => {
    expect(setupWarnings(round('r-vb2-hk2-nhap'))).toEqual([
      '7 mốc chưa có ngày',
      'chưa có sinh viên',
    ]);
    expect(setupWarnings(round('r-vb1-hk1'))).toEqual([]);
  });

  it('warns about unpublished topics when finishing', () => {
    expect(finishWarning(round('r-vb1-hk1'))).toBe(
      'Còn 2 đề tài chưa công bố.',
    );
    expect(finishWarning(round('r-vb2-hk1'))).toBeNull();
  });

  it('derives tasks for running, draft and finished rounds', () => {
    const running = deriveTasks(round('r-vb1-hk1'), TODAY).map((t) => t.text);
    expect(running).toContain('Mốc “Báo cáo giữa kỳ” kết thúc sau 4 ngày.');
    expect(running).toContain('2 đề tài chưa công bố.');
    expect(deriveTasks(round('r-vb2-hk2-nhap'), TODAY).length).toBe(2);
    expect(deriveTasks(round('r-vb1-hk2-2025'), TODAY)).toEqual([]);
  });
});
