import { expect, it } from 'vitest';
import {
  checkTemplate,
  draftToInput,
  newCriterion,
  newDraft,
  sameDraft,
  statusOf,
  toHundredths,
  uniqueName,
  type TemplateDraft,
} from './templateValidation';

const draft = (): TemplateDraft => ({
  name: ' Phiếu hội đồng ',
  description: '  ',
  criteria: [
    {
      key: 'c1',
      name: 'Ý nghĩa khoa học',
      description: ' Đánh giá qua phần trình bày ',
      maxScore: '3',
      subCriteria: [
        { key: 's1', name: 'Tính mới', maxScore: '1,5' },
        { key: 's2', name: 'Tính thực tiễn', maxScore: '1.5' },
      ],
    },
    {
      key: 'c2',
      name: 'Trình bày',
      description: '',
      maxScore: '7',
      subCriteria: [{ key: 's3', name: 'Báo cáo', maxScore: '7' }],
    },
  ],
});

it('parses scores with comma or dot and at most two decimals', () => {
  expect(toHundredths('1,5')).toBe(150);
  expect(toHundredths('0.25')).toBe(25);
  expect(toHundredths(' 10 ')).toBe(1000);
  expect(toHundredths('0')).toBe(0);
  expect(toHundredths('1.234')).toBeNull();
  expect(toHundredths('-1')).toBeNull();
  expect(toHundredths('')).toBeNull();
});

it('treats a complete template as eligible and builds the API input', () => {
  const check = checkTemplate(draft());
  expect(check).toEqual({ errors: {}, blocking: '', incomplete: '' });
  expect(statusOf(check)).toBe('Active');
  expect(draftToInput(draft(), 'Active')).toEqual({
    name: 'Phiếu hội đồng',
    description: null,
    maxScore: 10,
    status: 'Active',
    criteria: [
      {
        name: 'Ý nghĩa khoa học',
        description: 'Đánh giá qua phần trình bày',
        maxScore: 3,
        subCriteria: [
          { name: 'Tính mới', maxScore: 1.5 },
          { name: 'Tính thực tiễn', maxScore: 1.5 },
        ],
      },
      {
        name: 'Trình bày',
        description: null,
        maxScore: 7,
        subCriteria: [{ name: 'Báo cáo', maxScore: 7 }],
      },
    ],
  });
});

it('saves a new template as a draft, not as an error', () => {
  const check = checkTemplate(newDraft());
  expect(check.blocking).toBe('');
  expect(statusOf(check)).toBe('Draft');
  expect(check.incomplete).toContain(
    'Tổng điểm các tiêu chí chung phải bằng 10 (đang là 0).',
  );
  expect(check.incomplete).toContain(
    'Điểm tối đa phải lớn hơn 0 ở mục 1, 1.1.',
  );
});

it('turns a template whose totals do not match into a draft', () => {
  const d = draft();
  d.criteria[1].maxScore = '6';
  const check = checkTemplate(d);
  expect(check.blocking).toBe('');
  expect(statusOf(check)).toBe('Draft');
  expect(check.errors.total).toBe(
    'Tổng điểm các tiêu chí chung phải bằng 10 (đang là 9).',
  );
  expect(check.incomplete).toContain(
    'Tổng hạng mục con chưa khớp điểm tiêu chí ở tiêu chí 2.',
  );
});

it('flags a new criterion with no sub-criteria as incomplete', () => {
  const d = draft();
  d.criteria.push(newCriterion());
  const check = checkTemplate(d);
  expect(statusOf(check)).toBe('Draft');
  expect(check.incomplete).toContain('ở tiêu chí 3.');
});

it('blocks saving on bad names and scores even for drafts', () => {
  const d = draft();
  d.criteria[1].name = '  ý NGHĨA khoa học ';
  d.criteria[0].subCriteria[1].name = 'tính mới';
  d.criteria[0].subCriteria[0].maxScore = 'abc';
  const check = checkTemplate(d, ['Phiếu khác']);
  expect(check.errors['c2.name']).toBe(
    'Trùng tên với tiêu chí 1. Đặt tên khác để phân biệt.',
  );
  expect(check.errors['s2.name']).toBe(
    'Trùng tên với hạng mục khác trong tiêu chí này.',
  );
  expect(check.blocking).toContain('Tên tiêu chí bị trùng ở tiêu chí 2.');
  expect(check.blocking).toContain('Điểm không hợp lệ ở mục 1.1.');
  expect(checkTemplate(draft(), ['phiếu HỘI ĐỒNG']).errors.name).toBe(
    'Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.',
  );
  expect(checkTemplate({ ...draft(), name: ' ' }).blocking).toContain(
    'mẫu phiếu chưa có tên',
  );
});

it('picks a name that does not clash with existing templates', () => {
  expect(uniqueName('Mẫu phiếu mới', [])).toBe('Mẫu phiếu mới');
  expect(uniqueName('Mẫu phiếu mới', ['mẫu phiếu MỚI'])).toBe(
    'Mẫu phiếu mới (2)',
  );
  expect(
    uniqueName('Mẫu phiếu mới', ['Mẫu phiếu mới', 'Mẫu phiếu mới (2)']),
  ).toBe('Mẫu phiếu mới (3)');
});

it('compares drafts ignoring row keys', () => {
  const a = draft();
  const b = draft();
  b.criteria[0].key = 'other';
  expect(sameDraft(a, b)).toBe(true);
  b.criteria[0].name = 'Khác';
  expect(sameDraft(a, b)).toBe(false);
});
