import { expect, it } from 'vitest';
import {
  displayDateToIso,
  formatDateOrDash,
  isoToDisplayDate,
  maskDateTyping,
} from './date';

it('formats an ISO date as dd/MM/yyyy', () => {
  expect(formatDateOrDash('2003-09-05')).toBe('05/09/2003');
  expect(formatDateOrDash('2003-09-05T10:20:30Z')).toBe('05/09/2003');
});

it('shows a dash when there is no date', () => {
  expect(formatDateOrDash(null)).toBe('—');
  expect(formatDateOrDash('')).toBe('—');
});

it('returns an unrecognised value unchanged', () => {
  expect(formatDateOrDash('05/09/2003')).toBe('05/09/2003');
});

it('converts between ISO and dd/MM/yyyy for date inputs', () => {
  expect(isoToDisplayDate('2026-10-13')).toBe('13/10/2026');
  expect(isoToDisplayDate('')).toBe('');
  expect(displayDateToIso('13/10/2026')).toBe('2026-10-13');
  expect(displayDateToIso('31/02/2026')).toBe('');
  expect(displayDateToIso('13/10/26')).toBe('');
});

it('masks typed digits into dd/MM/yyyy', () => {
  expect(maskDateTyping('1')).toBe('1');
  expect(maskDateTyping('131')).toBe('13/1');
  expect(maskDateTyping('13102026')).toBe('13/10/2026');
  expect(maskDateTyping('13/10/20269')).toBe('13/10/2026');
  expect(maskDateTyping('2026-10-13')).toBe('13/10/2026');
  expect(maskDateTyping('5.9.2026')).toBe('05/09/2026');
  expect(maskDateTyping('')).toBe('');
});
