import { expect, it } from 'vitest';
import {
  checkTemplate,
  draftToInput,
  newCriterion,
  newDraft,
  sameDraft,
  toHundredths,
  type TemplateDraft,
} from './templateValidation';

const draft = (): TemplateDraft => ({
  name: ' Phiếu hội đồng ',
  description: '  ',
  maxScore: '10',
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

it('accepts a complete template and builds the API input', () => {
  expect(checkTemplate(draft())).toEqual({ errors: {}, summary: '' });
  expect(draftToInput(draft(), 'Draft')).toEqual({
    name: 'Phiếu hội đồng',
    description: null,
    maxScore: 10,
    status: 'Draft',
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

it('starts a new template that is already valid, like the design', () => {
  const d = newDraft();
  expect(d.name).toBe('Mẫu phiếu mới');
  expect(checkTemplate(d).summary).toBe('');
});

it('reports totals that do not match', () => {
  const d = draft();
  d.criteria[1].maxScore = '6';
  const { errors, summary } = checkTemplate(d);
  expect(errors.total).toBe(
    'Tổng điểm các tiêu chí chung phải bằng 10 (đang là 9).',
  );
  expect(summary).toContain(
    'Tổng hạng mục con chưa khớp điểm tiêu chí ở tiêu chí 2.',
  );
});

it('flags a new criterion with no score and no sub-criteria', () => {
  const d = draft();
  d.criteria.push(newCriterion());
  const { summary } = checkTemplate(d);
  expect(summary).toContain('ở tiêu chí 3.');
  expect(summary).toContain('Điểm tối đa phải lớn hơn 0 ở mục 3.');
});

it('flags duplicate names ignoring case and spaces', () => {
  const d = draft();
  d.criteria[1].name = '  ý NGHĨA khoa học ';
  d.criteria[0].subCriteria[1].name = 'tính mới';
  const { errors, summary } = checkTemplate(d, ['Phiếu khác']);
  expect(errors['c2.name']).toBe(
    'Trùng tên với tiêu chí 1. Đặt tên khác để phân biệt.',
  );
  expect(errors['s2.name']).toBe(
    'Trùng tên với hạng mục khác trong tiêu chí này.',
  );
  expect(summary).toContain('Tên tiêu chí bị trùng ở tiêu chí 2.');
  expect(checkTemplate(draft(), ['phiếu HỘI ĐỒNG']).errors.name).toBe(
    'Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.',
  );
});

it('compares drafts ignoring row keys', () => {
  const a = draft();
  const b = draft();
  b.criteria[0].key = 'other';
  expect(sameDraft(a, b)).toBe(true);
  b.criteria[0].name = 'Khác';
  expect(sameDraft(a, b)).toBe(false);
});
