import type {
  EvaluationTemplate,
  TemplateInput,
  TemplateStatus,
} from '@/types/evaluation';

// Bản nháp trong trình sửa: điểm giữ dạng chuỗi như người dùng gõ ("1,5" hoặc "1.5").
// key chỉ dùng cho React và để gắn lỗi theo dòng, không gửi lên backend.
export interface DraftSubCriterion {
  key: string;
  name: string;
  maxScore: string;
}

export interface DraftCriterion {
  key: string;
  name: string;
  description: string;
  maxScore: string;
  subCriteria: DraftSubCriterion[];
}

export interface TemplateDraft {
  name: string;
  description: string;
  maxScore: string;
  criteria: DraftCriterion[];
}

// Giới hạn giống EvaluationTemplateRules ở backend; thang điểm cố định 10 theo
// design (backend vẫn nhận thang khác cho các mẫu tạo qua API).
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;
export const TEMPLATE_SCALE = 10;

// Lỗi theo ô: 'name', 'description', 'total' (tổng tiêu chí chung),
// `${key}.name`, `${key}.description`, `${key}.maxScore`, `${key}.total`.
export type TemplateErrors = Record<string, string>;

let sequence = 0;
export const newKey = () => `k${++sequence}`;

// Giá trị mặc định khi thêm dòng theo design: tên gợi ý, điểm 0 để Giáo vụ điền.
export const newSub = (): DraftSubCriterion => ({
  key: newKey(),
  name: 'Hạng mục mới',
  maxScore: '0',
});

export const newCriterion = (): DraftCriterion => ({
  key: newKey(),
  name: 'Tiêu chí mới',
  description: '',
  maxScore: '0',
  subCriteria: [],
});

export const newDraft = (name = 'Mẫu phiếu mới'): TemplateDraft => ({
  name,
  description: '',
  maxScore: String(TEMPLATE_SCALE),
  criteria: [
    {
      key: newKey(),
      name: 'Tiêu chí 1',
      description: '',
      maxScore: String(TEMPLATE_SCALE),
      subCriteria: [
        {
          key: newKey(),
          name: 'Hạng mục 1.1',
          maxScore: String(TEMPLATE_SCALE),
        },
      ],
    },
  ],
});

export const draftFromTemplate = (t: EvaluationTemplate): TemplateDraft => ({
  name: t.name,
  description: t.description ?? '',
  maxScore: String(t.maxScore),
  criteria: t.criteria.map((c) => ({
    key: newKey(),
    name: c.name,
    description: c.description ?? '',
    maxScore: String(c.maxScore),
    subCriteria: c.subCriteria.map((s) => ({
      key: newKey(),
      name: s.name,
      maxScore: String(s.maxScore),
    })),
  })),
});

// So sánh nội dung, bỏ qua key, để biết trình sửa có thay đổi chưa lưu.
export const sameDraft = (a: TemplateDraft, b: TemplateDraft) => {
  const strip = (d: TemplateDraft) =>
    JSON.stringify({
      ...d,
      criteria: d.criteria.map(({ key: _k, subCriteria, ...c }) => ({
        ...c,
        subCriteria: subCriteria.map(({ key: _s, ...s }) => s),
      })),
    });
  return strip(a) === strip(b);
};

// Điểm quy về phần trăm điểm (số nguyên) để cộng không sai số; null nếu không
// phải số không âm có tối đa hai chữ số thập phân.
export function toHundredths(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const formatScore = (hundredths: number) =>
  (hundredths / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const sumOf = (values: string[]) =>
  values.reduce((total, v) => total + (toHundredths(v) ?? 0), 0);

export const criteriaTotal = (draft: TemplateDraft) =>
  sumOf(draft.criteria.map((c) => c.maxScore));

export const subTotal = (criterion: DraftCriterion) =>
  sumOf(criterion.subCriteria.map((s) => s.maxScore));

export const nameKey = (name: string) => name.trim().toLocaleLowerCase('vi-VN');

const validScore = (value: string) => {
  const h = toHundredths(value);
  return h !== null && h > 0;
};

export interface TemplateCheck {
  errors: TemplateErrors;
  // Câu tóm tắt dưới bảng như design; rỗng khi mẫu hợp lệ.
  summary: string;
}

// Cùng quy tắc với backend cho mẫu không phải nháp: đủ tiêu chí và hạng mục,
// điểm > 0, tổng tiêu chí chung = thang phiếu, tổng hạng mục con = điểm tiêu chí,
// không trùng tên. otherNames: tên các mẫu khác để báo trùng ngay khi gõ.
export function checkTemplate(
  draft: TemplateDraft,
  otherNames: string[] = [],
): TemplateCheck {
  const errors: TemplateErrors = {};
  const parts: string[] = [];

  const name = nameKey(draft.name);
  if (!name) errors.name = 'Nhập tên mẫu phiếu.';
  else if (draft.name.trim().length > MAX_NAME_LENGTH)
    errors.name = `Tên mẫu phiếu tối đa ${MAX_NAME_LENGTH} ký tự.`;
  else if (otherNames.some((n) => nameKey(n) === name))
    errors.name = 'Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.';
  if (errors.name)
    parts.push(
      !name
        ? 'Chưa lưu được: mẫu phiếu chưa có tên.'
        : 'Chưa lưu được: tên mẫu phiếu bị trùng hoặc quá dài.',
    );
  if (draft.description.trim().length > MAX_DESCRIPTION_LENGTH)
    errors.description = `Mô tả tối đa ${MAX_DESCRIPTION_LENGTH} ký tự.`;

  const scale = toHundredths(draft.maxScore) ?? TEMPLATE_SCALE * 100;
  const total = criteriaTotal(draft);
  if (draft.criteria.length === 0) {
    errors.total = 'Mẫu phải có ít nhất một tiêu chí chung.';
    parts.push(errors.total);
  } else if (total !== scale) {
    errors.total = `Tổng điểm các tiêu chí chung phải bằng ${formatScore(scale)} (đang là ${formatScore(total)}).`;
    parts.push(errors.total);
  }

  const mismatch: number[] = [];
  const badScores: string[] = [];
  const dupCriteria: number[] = [];
  let dupSubs = false;
  const seen = new Map<string, number>();
  draft.criteria.forEach((c, i) => {
    const no = i + 1;
    const key = nameKey(c.name);
    if (!key) errors[`${c.key}.name`] = 'Nhập tên tiêu chí chung.';
    else if (seen.has(key)) {
      errors[`${c.key}.name`] =
        `Trùng tên với tiêu chí ${seen.get(key)}. Đặt tên khác để phân biệt.`;
      dupCriteria.push(no);
    } else seen.set(key, no);
    if (c.description.trim().length > MAX_DESCRIPTION_LENGTH)
      errors[`${c.key}.description`] =
        `Mô tả tối đa ${MAX_DESCRIPTION_LENGTH} ký tự.`;
    if (!validScore(c.maxScore)) {
      errors[`${c.key}.maxScore`] = 'Điểm phải lớn hơn 0.';
      badScores.push(String(no));
    }

    const seenSubs = new Set<string>();
    c.subCriteria.forEach((s, j) => {
      const subKey = nameKey(s.name);
      if (!subKey) errors[`${s.key}.name`] = 'Nhập tên hạng mục con.';
      else if (seenSubs.has(subKey)) {
        errors[`${s.key}.name`] =
          'Trùng tên với hạng mục khác trong tiêu chí này.';
        dupSubs = true;
      }
      seenSubs.add(subKey);
      if (!validScore(s.maxScore)) {
        errors[`${s.key}.maxScore`] = 'Điểm phải lớn hơn 0.';
        badScores.push(`${no}.${j + 1}`);
      }
    });

    if (c.subCriteria.length === 0) {
      errors[`${c.key}.total`] = 'Tiêu chí phải có ít nhất một hạng mục con.';
      mismatch.push(no);
    } else if (subTotal(c) !== toHundredths(c.maxScore)) {
      errors[`${c.key}.total`] = 'mismatch';
      mismatch.push(no);
    }
  });

  if (mismatch.length)
    parts.push(
      `Tổng hạng mục con chưa khớp điểm tiêu chí ở tiêu chí ${mismatch.join(', ')}.`,
    );
  if (badScores.length)
    parts.push(`Điểm tối đa phải lớn hơn 0 ở mục ${badScores.join(', ')}.`);
  if (dupCriteria.length)
    parts.push(`Tên tiêu chí bị trùng ở tiêu chí ${dupCriteria.join(', ')}.`);
  if (dupSubs) parts.push('Có hạng mục con trùng tên trong cùng tiêu chí.');
  const emptyNames = Object.entries(errors).some(
    ([k, v]) => k.endsWith('.name') && v.startsWith('Nhập tên'),
  );
  if (emptyNames) parts.push('Còn tiêu chí hoặc hạng mục chưa có tên.');
  if (Object.keys(errors).some((k) => k.endsWith('description')))
    parts.push(`Mô tả tối đa ${MAX_DESCRIPTION_LENGTH} ký tự.`);

  return { errors, summary: parts.join(' ') };
}

const toNumber = (value: string) => (toHundredths(value) ?? 0) / 100;

export const draftToInput = (
  draft: TemplateDraft,
  status: TemplateStatus,
): TemplateInput => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  maxScore: toNumber(draft.maxScore),
  status,
  criteria: draft.criteria.map((c) => ({
    name: c.name.trim(),
    description: c.description.trim() || null,
    maxScore: toNumber(c.maxScore),
    subCriteria: c.subCriteria.map((s) => ({
      name: s.name.trim(),
      maxScore: toNumber(s.maxScore),
    })),
  })),
});
