import type { RoundInput } from '@/types/round';
import { ROUND_PROGRAMS } from '@/types/round';

export type RoundField = 'name' | 'program' | 'periodLabel';
export type RoundFieldErrors = Partial<Record<RoundField, string>>;

// Khóa so sánh tên đợt: bỏ khoảng trắng đầu cuối, không phân biệt hoa thường.
export const nameKey = (name: string) => name.trim().toLowerCase();

export function normalizeRoundInput(input: RoundInput): RoundInput {
  return {
    ...input,
    name: input.name.trim().replace(/\s+/g, ' '),
    periodLabel: input.periodLabel.trim(),
  };
}

export function validateRoundInput(input: RoundInput): RoundFieldErrors {
  const value = normalizeRoundInput(input);
  const errors: RoundFieldErrors = {};
  if (!value.name) errors.name = 'Nhập tên đợt.';
  if (!value.program || !ROUND_PROGRAMS.includes(value.program))
    errors.program = 'Chọn chương trình.';
  if (!value.periodLabel) errors.periodLabel = 'Nhập học kỳ hoặc khóa.';
  return errors;
}
