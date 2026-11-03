import { describe, expect, it } from 'vitest';
import {
  currentMilestone,
  currentWeek,
  deriveTasks,
  PUBLISH_TASK_TEXT,
  finishBlockedMessage,
  formatDate,
  isIsoDate,
  openBlockers,
  publishBlocker,
  registrationClosed,
  registrationDaysLeft,
  registrationEndedMessage,
  roundStage,
  submissionClosed,
  milestoneProgress,
  milestoneStatus,
  roundSpan,
  setupWarnings,
  validateMilestones,
  weekOf,
} from './roundUtils';
import type { Round } from '@/types/round';
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
  it('lists the non-blocking setup gaps of a draft (people only)', () => {
    expect(setupWarnings(round('r-vb2-hk2-nhap'))).toEqual([
      'chưa có sinh viên',
    ]);
    expect(setupWarnings(round('r-vb1-hk1'))).toEqual([]);
  });

  it('lists a blocker per milestone without a valid date', () => {
    const blockers = openBlockers(round('r-vb2-hk2-nhap'));
    expect(blockers).toHaveLength(7);
    expect(blockers).toContain('Đề cương: chưa đặt ngày');
    expect(openBlockers(round('r-vb1-hk1'))).toEqual([]);

    const bad = round('r-vb1-hk1');
    bad.milestones[3].endDate = '2026-01-01';
    bad.milestones[4].startDate = '';
    bad.milestones[4].endDate = '';
    expect(openBlockers(bad)).toEqual([
      expect.stringMatching(/^Báo cáo giữa kỳ: Ngày kết thúc phải sau/),
      'Báo cáo cuối kỳ: chưa đặt ngày',
    ]);
  });

  it('blocks finishing while topics are waiting for results', () => {
    const vb1 = round('r-vb1-hk1');
    expect(vb1.topicSummary.pendingResultCount).toBe(12);
    expect(finishBlockedMessage(vb1)).toBe(
      'Còn 12 đề tài chưa công bố kết quả. Công bố hết ở trang Kết quả (/giao-vu/ket-qua) rồi mới kết thúc được đợt. Đề tài Không có nhóm không tính.',
    );
    expect(
      finishBlockedMessage(withSummary(vb1, { pendingResultCount: 0 })),
    ).toBeNull();
  });

  it('derives tasks for running, draft and finished rounds', () => {
    const running = deriveTasks(round('r-vb1-hk1'), TODAY).map((t) => t.text);
    expect(running).toContain('Mốc “Báo cáo giữa kỳ” kết thúc sau 4 ngày.');
    expect(running).not.toContain(PUBLISH_TASK_TEXT);
    expect(deriveTasks(round('r-vb2-hk2-nhap'), TODAY).length).toBe(2);
    expect(deriveTasks(round('r-vb1-hk2-2025'), TODAY)).toEqual([]);
  });

  it('asks to review and publish once the lecturer deadline has passed', () => {
    // ThS: hết hạn GV gửi (14/08) mà chưa công bố.
    const task = deriveTasks(round('r-ths-1-2026'), TODAY).find(
      (t) => t.id === 'publish-topics',
    );
    expect(task).toEqual({
      id: 'publish-topics',
      text: 'Đã hết hạn giảng viên gửi đề tài. Xem và công bố danh sách.',
      tab: 'de-tai',
    });
    // Còn hạn gửi hoặc đã công bố thì không nhắc.
    const early = deriveTasks(round('r-ths-1-2026'), '2026-08-14');
    expect(early.some((t) => t.id === 'publish-topics')).toBe(false);
    expect(
      deriveTasks(round('r-vb1-hk1'), TODAY).some(
        (t) => t.id === 'publish-topics',
      ),
    ).toBe(false);
  });

  it('reminds about unpublished results only once the finalize milestone has started', () => {
    const vb1 = round('r-vb1-hk1');
    const text = '12 đề tài chưa công bố kết quả.';
    expect(deriveTasks(vb1, TODAY).map((t) => t.text)).not.toContain(text);
    expect(deriveTasks(vb1, '2027-01-05').map((t) => t.text)).toContain(text);
  });
});

const withSummary = (
  r: Round,
  patch: Partial<Round['topicSummary']>,
): Round => ({
  ...r,
  topicSummary: { ...r.topicSummary, ...patch },
});

describe('registration window', () => {
  const ths = round('r-ths-1-2026'); // GV gửi đến 14/08, đăng ký đến 28/08
  it('closes at the end of the end date and counts days including today', () => {
    expect(submissionClosed(ths, '2026-08-14')).toBe(false);
    expect(submissionClosed(ths, '2026-08-15')).toBe(true);
    expect(registrationClosed(ths, '2026-08-28')).toBe(false);
    expect(registrationClosed(ths, '2026-08-29')).toBe(true);
    expect(registrationDaysLeft(ths, '2026-08-20')).toBe(9);
    expect(registrationDaysLeft(ths, '2026-08-28')).toBe(1);
    expect(registrationDaysLeft(ths, '2026-08-29')).toBe(0);
    expect(
      registrationDaysLeft({ ...ths, milestones: buildMilestones([]) }, TODAY),
    ).toBeNull();
  });
});

describe('publishBlocker', () => {
  const ths = round('r-ths-1-2026');
  it('does not depend on the lecturer submission deadline', () => {
    expect(publishBlocker(ths, '2026-08-05')).toBeNull(); // GV còn gửi
    expect(publishBlocker(ths, '2026-08-28')).toBeNull();
  });

  it('blocks after registration ended, when published, not running or empty', () => {
    expect(publishBlocker(ths, '2026-08-29')).toBe(
      registrationEndedMessage('2026-08-28'),
    );
    expect(registrationEndedMessage('2026-08-28')).toBe(
      'Đã hết thời gian sinh viên đăng ký đề tài (hết ngày 28/08/2026). Sửa mốc “Công bố đề tài · SV đăng ký” ở tab Cấu hình rồi công bố.',
    );
    expect(publishBlocker(round('r-vb1-hk1'), '2026-09-22')).toBe(
      'Danh sách đề tài của đợt đã được công bố.',
    );
    expect(publishBlocker(round('r-vb2-hk2-nhap'), TODAY)).toBe(
      'Chỉ công bố được danh sách đề tài của đợt đang diễn ra.',
    );
    expect(publishBlocker(withSummary(ths, { total: 0 }), '2026-08-20')).toBe(
      'Chưa có đề tài để công bố.',
    );
  });
});

describe('roundStage', () => {
  const ths = round('r-ths-1-2026');
  const vb1 = round('r-vb1-hk1');
  const published = (r: Round): Round => ({
    ...r,
    topicsPublishedAt: '2026-08-20T08:00:00.000Z',
  });

  it('follows the stages of a running round', () => {
    expect(roundStage(ths, '2026-08-10')).toBe('GV gửi đề tài');
    expect(roundStage(ths, '2026-08-14')).toBe('GV gửi đề tài');
    expect(roundStage(ths, '2026-08-15')).toBe('Chờ công bố danh sách');
    expect(roundStage(published(ths), '2026-08-25')).toBe('SV đăng ký');
    expect(roundStage(published(ths), '2026-08-28')).toBe('SV đăng ký');
    expect(roundStage(published(ths), '2026-08-29')).toBe('Thực hiện');
    expect(roundStage(vb1, TODAY)).toBe('Thực hiện');
  });

  it('is ready to finish when no topic is waiting for results', () => {
    const ready = withSummary(vb1, { pendingResultCount: 0 });
    expect(roundStage(ready, TODAY)).toBe('Sẵn sàng kết thúc');
    expect(roundStage(withSummary(ready, { total: 0 }), TODAY)).toBe(
      'Thực hiện',
    );
  });

  it('has no stage for draft and finished rounds', () => {
    expect(roundStage(round('r-vb2-hk2-nhap'), TODAY)).toBeNull();
    expect(roundStage(round('r-vb1-hk2-2025'), TODAY)).toBeNull();
  });
});

it('rejects dates that do not exist', () => {
  expect(isIsoDate('2026-02-28')).toBe(true);
  expect(isIsoDate('2028-02-29')).toBe(true);
  expect(isIsoDate('2026-02-30')).toBe(false);
  expect(isIsoDate('2026-13-01')).toBe(false);
  expect(isIsoDate('2026-1-01')).toBe(false);
  expect(formatDate('2026-04-31')).toBe('Chưa đặt');
});
