import { addDays } from '@/features/rounds/roundUtils';
import {
  MILESTONE_DEFS,
  type Milestone,
  type MilestoneKey,
} from '@/types/round';

// OQ-033(a): giá trị tạm
export const MILESTONE_WEEKS: readonly number[] = [2, 2, 2, 4, 4, 2, 2, 4, 2];

export interface AutofilledMilestone {
  key: MilestoneKey;
  startDate: string;
  endDate: string;
}

export function autofillMilestones(startIso: string): AutofilledMilestone[];
export function autofillMilestones(
  milestones: Milestone[],
  startIso: string,
): Milestone[];
export function autofillMilestones(
  first: string | Milestone[],
  second?: string,
): AutofilledMilestone[] | Milestone[] {
  const startIso = typeof first === 'string' ? first : second!;
  const result: AutofilledMilestone[] = [];
  let prevEnd = startIso;
  let reviewStart = '';
  let defenseEnd = '';

  for (let i = 0; i < MILESTONE_DEFS.length; i++) {
    const key = MILESTONE_DEFS[i].key;
    const weeks = MILESTONE_WEEKS[i] ?? 2;
    let s = prevEnd;

    if (key === 'grading') {
      // Mốc 8 (grading) bắt đầu cùng mốc 6 (reviewSchedule)
      s = reviewStart || prevEnd;
    } else if (key === 'finalize') {
      // Mốc 9 (finalize) bắt đầu tại ngày kết thúc mốc 7 (defenseSchedule)
      s = defenseEnd || prevEnd;
    }

    const e = addDays(s, weeks * 7);

    if (key === 'reviewSchedule') {
      reviewStart = s;
    } else if (key === 'defenseSchedule') {
      defenseEnd = e;
    }

    if (key !== 'grading') {
      prevEnd = e;
    }

    result.push({ key, startDate: s, endDate: e });
  }

  if (typeof first === 'string') {
    return result;
  }

  const map = new Map(result.map((r) => [r.key, r]));
  return first.map((m) => {
    const autofilled = map.get(m.key);
    return autofilled
      ? { ...m, startDate: autofilled.startDate, endDate: autofilled.endDate }
      : m;
  });
}

export function suggestStart(
  milestones: Milestone[],
  index: number,
): string | null {
  const current = milestones[index];
  if (!current) return null;

  if (current.key === 'grading') {
    // So với mốc 6 (reviewSchedule) hoặc mốc gần nhất trước 6
    for (let i = 5; i >= 0; i--) {
      const m = milestones[i];
      if (m?.startDate) return m.startDate;
    }
    return null;
  }

  if (current.key === 'finalize') {
    // So với mốc 7 (defenseSchedule) hoặc mốc gần nhất trước 7
    for (let i = 6; i >= 0; i--) {
      const m = milestones[i];
      if (m?.startDate) return m.startDate;
    }
    return null;
  }

  // Các mốc khác: tìm mốc có ngày gần nhất phía trước
  for (let i = index - 1; i >= 0; i--) {
    const m = milestones[i];
    if (m?.startDate) return m.startDate;
  }

  return null;
}
