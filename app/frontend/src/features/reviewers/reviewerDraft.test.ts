import { expect, it } from 'vitest';
import type {
  ReviewerLecturer,
  ReviewerTopicRow,
} from '@/types/reviewer';
import {
  applySuggestions,
  assignMany,
  buildBatch,
  dirtyRows,
  initialDraft,
  projectedLoad,
} from './reviewerDraft';

const person = (id: string) => ({ id, code: id.toUpperCase(), name: id });

const row = (
  id: string,
  overrides: Partial<ReviewerTopicRow> = {},
): ReviewerTopicRow => ({
  topicId: id,
  code: `DT-${id}`,
  title: `Đề tài ${id}`,
  field: 'CNPM',
  supervisor: person('a'),
  group: [],
  outlineApprovedAt: '2026-09-10T00:00:00Z',
  reviewer: null,
  assignedAt: null,
  eligible: true,
  blockedReason: null,
  locked: false,
  lockReason: null,
  hasMidterm: false,
  hasFinal: false,
  ...overrides,
});

const lecturer = (id: string, reviewCount: number): ReviewerLecturer => ({
  id,
  code: id.toUpperCase(),
  name: id,
  department: null,
  reviewCount,
  superviseCount: 0,
  max: 2,
  level: 'ok',
});

it('starts from the current assignment and marks only changed editable rows as dirty', () => {
  const rows = [
    row('1', { reviewer: person('b') }),
    row('2'),
    row('3', { eligible: false, blockedReason: 'Chưa duyệt đề cương' }),
    row('4', { reviewer: person('b'), locked: true, lockReason: 'Đã khóa' }),
  ];
  const draft = initialDraft(rows);
  expect(draft).toEqual({ '1': 'b', '2': '', '3': '', '4': 'b' });
  expect(dirtyRows(rows, draft)).toEqual([]);

  const changed = { ...draft, '1': 'c', '2': 'b', '3': 'b', '4': 'c' };
  // Dòng chưa đủ điều kiện và dòng đã khóa không bao giờ bẩn.
  expect(dirtyRows(rows, changed).map((r) => r.topicId)).toEqual(['1', '2']);
});

it('applies suggestions only to empty editable rows and keeps notes for rows without a candidate', () => {
  const rows = [
    row('1'),
    row('2', { reviewer: person('b') }),
    row('3'),
    row('4', { locked: true }),
    row('5'),
  ];
  const draft = { ...initialDraft(rows), '3': 'c' };

  const result = applySuggestions(rows, draft, [
    { topicId: '1', lecturerId: 'b', reason: 'x' },
    { topicId: '2', lecturerId: 'c', reason: 'x' },
    { topicId: '3', lecturerId: 'b', reason: 'x' },
    { topicId: '4', lecturerId: 'b', reason: 'x' },
    { topicId: '5', lecturerId: null, reason: 'Không có ứng viên' },
  ]);

  expect(result.draft).toEqual({ '1': 'b', '2': 'b', '3': 'c', '4': '', '5': '' });
  expect(result.applied).toEqual(['1']);
  expect(result.notes).toEqual({ '5': 'Không có ứng viên' });
});

it('projects the review load of each lecturer from the draft', () => {
  const rows = [row('1', { reviewer: person('b') }), row('2'), row('3')];
  const lecturers = [lecturer('b', 1), lecturer('c', 0)];
  const draft = { '1': 'c', '2': 'c', '3': 'b' };

  expect(projectedLoad(lecturers, rows, draft)).toEqual({ b: 1, c: 2 });
});

it('builds the batch payload with the current reviewer as the expected value', () => {
  const rows = [row('1', { reviewer: person('b') }), row('2'), row('3')];
  const draft = { '1': 'c', '2': 'b', '3': '' };

  expect(buildBatch(rows, draft)).toEqual([
    { topicId: '1', reviewerId: 'c', expectedReviewerId: 'b' },
    { topicId: '2', reviewerId: 'b', expectedReviewerId: null },
  ]);
});

it('assigns one lecturer to many rows and skips supervised, locked and ineligible ones', () => {
  const rows = [
    row('1'),
    row('2', { supervisor: person('b') }),
    row('3', { locked: true }),
    row('4', { eligible: false }),
  ];

  const result = assignMany(rows, initialDraft(rows), ['1', '2', '3', '4'], 'b');

  expect(result.applied).toBe(1);
  expect(result.skipped).toBe(3);
  expect(result.draft['1']).toBe('b');
  expect(result.draft['2']).toBe('');
});
