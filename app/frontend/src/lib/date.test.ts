import { expect, it } from 'vitest';
import { formatDateOrDash } from './date';

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
