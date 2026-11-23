import { describe, expect, it } from 'vitest';
import {
  autofillMilestones,
  suggestStart,
} from './milestoneAutofill';
import { buildMilestones } from './services/roundSeed';

describe('milestoneAutofill', () => {
  it('autofills all 9 milestones with correct durations and dependencies', () => {
    const list = autofillMilestones('2026-09-01');
    expect(list).toHaveLength(9);

    // Mốc 1: GV gửi đề tài (2 tuần = 14 ngày)
    expect(list[0]).toEqual({
      key: 'topicSubmission',
      startDate: '2026-09-01',
      endDate: '2026-09-15',
    });

    // Mốc 2: Công bố đề tài · SV đăng ký (2 tuần = 14 ngày)
    expect(list[1]).toEqual({
      key: 'topicRegistration',
      startDate: '2026-09-15',
      endDate: '2026-09-29',
    });

    // Mốc 3: Đề cương (2 tuần)
    expect(list[2]).toEqual({
      key: 'outline',
      startDate: '2026-09-29',
      endDate: '2026-10-13',
    });

    // Mốc 4: Báo cáo giữa kỳ (4 tuần = 28 ngày)
    expect(list[3]).toEqual({
      key: 'midterm',
      startDate: '2026-10-13',
      endDate: '2026-11-10',
    });

    // Mốc 5: Báo cáo cuối kỳ (4 tuần)
    expect(list[4]).toEqual({
      key: 'final',
      startDate: '2026-11-10',
      endDate: '2026-12-08',
    });

    // Mốc 6: Lịch phản biện (2 tuần)
    expect(list[5]).toEqual({
      key: 'reviewSchedule',
      startDate: '2026-12-08',
      endDate: '2026-12-22',
    });

    // Mốc 7: Lịch bảo vệ (2 tuần)
    expect(list[6]).toEqual({
      key: 'defenseSchedule',
      startDate: '2026-12-22',
      endDate: '2027-01-05',
    });

    // Mốc 8: Thời gian cho điểm (4 tuần, bắt đầu cùng mốc 6)
    expect(list[7]).toEqual({
      key: 'grading',
      startDate: '2026-12-08',
      endDate: '2027-01-05',
    });

    // Mốc 9: Chốt bản cuối · công bố (2 tuần, bắt đầu tại ngày kết thúc mốc 7)
    expect(list[8]).toEqual({
      key: 'finalize',
      startDate: '2027-01-05',
      endDate: '2027-01-19',
    });
  });

  it('handles leap year correctly (February 29)', () => {
    // Năm 2024 là năm nhuận, tháng 2 có 29 ngày
    const list = autofillMilestones('2024-02-15');
    // 14 ngày sau 15/02/2024 là 29/02/2024
    expect(list[0].startDate).toBe('2024-02-15');
    expect(list[0].endDate).toBe('2024-02-29');
    expect(list[1].startDate).toBe('2024-02-29');
    expect(list[1].endDate).toBe('2024-03-14');
  });

  it('handles month transitions correctly across year-end', () => {
    const list = autofillMilestones('2025-12-25');
    expect(list[0].startDate).toBe('2025-12-25');
    expect(list[0].endDate).toBe('2026-01-08');
  });

  describe('suggestStart', () => {
    it('suggests previous milestone start date for ordinary milestones', () => {
      const milestones = buildMilestones([
        ['2026-09-10', '2026-09-24'],
        ['2026-09-01', '2026-09-20'], // mốc 2 bắt đầu sớm hơn mốc 1
      ]);
      const suggested = suggestStart(milestones, 1);
      expect(suggested).toBe('2026-09-10');
    });

    it('suggests milestone 6 start date for milestone 8 (grading)', () => {
      const milestones = buildMilestones([
        ['2026-09-01', '2026-09-14'],
        ['2026-09-15', '2026-09-28'],
        ['2026-09-29', '2026-10-12'],
        ['2026-10-13', '2026-11-10'],
        ['2026-11-10', '2026-12-08'],
        ['2026-12-08', '2026-12-22'], // mốc 6 (index 5)
        ['2026-12-22', '2027-01-05'], // mốc 7 (index 6)
        ['2026-11-01', '2026-12-01'], // mốc 8 (index 7) xung đột
        null,
      ]);
      const suggested = suggestStart(milestones, 7);
      expect(suggested).toBe('2026-12-08');
    });

    it('suggests milestone 7 start date for milestone 9 (finalize)', () => {
      const milestones = buildMilestones([
        ['2026-09-01', '2026-09-14'],
        ['2026-09-15', '2026-09-28'],
        ['2026-09-29', '2026-10-12'],
        ['2026-10-13', '2026-11-10'],
        ['2026-11-10', '2026-12-08'],
        ['2026-12-08', '2026-12-22'], // mốc 6
        ['2026-12-22', '2027-01-05'], // mốc 7 (index 6)
        ['2026-12-08', '2027-01-05'], // mốc 8 (grading)
        ['2026-12-01', '2026-12-15'], // mốc 9 (index 8) xung đột
      ]);
      const suggested = suggestStart(milestones, 8);
      expect(suggested).toBe('2026-12-22');
    });
  });
});
