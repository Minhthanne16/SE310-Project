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
  criteria: DraftCriterion[];
}

// Thang điểm phiếu cố định 10 theo design; không cần cấu hình.
export const TEMPLATE_SCALE = 10;
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;

// Lỗi theo ô: 'name', 'description', 'total', `${key}.name`, `${key}.description`,
// `${key}.maxScore`, `${key}.total`.
export type TemplateErrors = Record<string, string>;

let sequence = 0;
export const newKey = () => `k${++sequence}`;

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

// Mẫu mới bắt đầu từ điểm 0: tổng chưa đủ 10 nên lưu ra là Nháp.
export const newDraft = (name = 'Mẫu phiếu mới'): TemplateDraft => ({
  name,
  description: '',
  criteria: [
    {
      key: newKey(),
      name: 'Tiêu chí 1',
      description: '',
      maxScore: '0',
      subCriteria: [{ key: newKey(), name: 'Hạng mục 1.1', maxScore: '0' }],
    },
  ],
});

// Tên chưa trùng với names: "Mẫu phiếu mới", "Mẫu phiếu mới (2)", ...
export function uniqueName(base: string, names: string[]): string {
  const taken = new Set(names.map((n) => n.trim().toLocaleLowerCase('vi-VN')));
  const isFree = (n: string) => !taken.has(n.trim().toLocaleLowerCase('vi-VN'));
  if (isFree(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (isFree(candidate)) return candidate;
  }
}

const formatInput = (value: number) => String(value).replace('.', ',');

export const draftFromTemplate = (t: EvaluationTemplate): TemplateDraft => ({
  name: t.name,
  description: t.description ?? '',
  criteria: t.criteria.map((c) => ({
    key: newKey(),
    name: c.name,
    description: c.description ?? '',
    maxScore: formatInput(c.maxScore),
    subCriteria: c.subCriteria.map((s) => ({
      key: newKey(),
      name: s.name,
      maxScore: formatInput(s.maxScore),
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

export interface TemplateCheck {
  errors: TemplateErrors;
  // Lỗi chặn lưu ở mọi trạng thái (tên, độ dài, trùng tên, điểm không hợp lệ).
  blocking: string;
  // Chưa đủ điều kiện sử dụng (tổng điểm chưa khớp, điểm 0, thiếu hạng mục...):
  // mẫu vẫn lưu được nhưng ở trạng thái Nháp.
  incomplete: string;
}

// otherNames: tên các mẫu khác để báo trùng ngay khi gõ.
export function checkTemplate(
  draft: TemplateDraft,
  otherNames: string[] = [],
): TemplateCheck {
  const errors: TemplateErrors = {};
  const blocking: string[] = [];
  const incomplete: string[] = [];

  const name = nameKey(draft.name);
  if (!name) errors.name = 'Nhập tên mẫu phiếu.';
  else if (draft.name.trim().length > MAX_NAME_LENGTH)
    errors.name = `Tên mẫu phiếu tối đa ${MAX_NAME_LENGTH} ký tự.`;
  else if (otherNames.some((n) => nameKey(n) === name))
    errors.name = 'Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.';
  if (errors.name)
    blocking.push(
      !name
        ? 'Chưa lưu được: mẫu phiếu chưa có tên.'
        : 'Chưa lưu được: tên mẫu phiếu bị trùng hoặc quá dài.',
    );
  if (draft.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Mô tả tối đa ${MAX_DESCRIPTION_LENGTH} ký tự.`;
    blocking.push(errors.description);
  }

  const scale = TEMPLATE_SCALE * 100;
  const total = criteriaTotal(draft);
  if (draft.criteria.length === 0) {
    errors.total = 'Mẫu phải có ít nhất một tiêu chí chung.';
    incomplete.push(errors.total);
  } else if (total !== scale) {
    errors.total = `Tổng điểm các tiêu chí chung phải bằng ${formatScore(scale)} (đang là ${formatScore(total)}).`;
    incomplete.push(errors.total);
  }

  const mismatch: number[] = [];
  const zero: string[] = [];
  const badScores: string[] = [];
  const dupCriteria: number[] = [];
  let dupSubs = false;
  let emptyNames = false;
  const seen = new Map<string, number>();
  draft.criteria.forEach((c, i) => {
    const no = i + 1;
    const key = nameKey(c.name);
    if (!key) {
      errors[`${c.key}.name`] = 'Nhập tên tiêu chí chung.';
      emptyNames = true;
    } else if (c.name.trim().length > MAX_NAME_LENGTH) {
      errors[`${c.key}.name`] = `Tên tối đa ${MAX_NAME_LENGTH} ký tự.`;
      emptyNames = true;
    } else if (seen.has(key)) {
      errors[`${c.key}.name`] =
        `Trùng tên với tiêu chí ${seen.get(key)}. Đặt tên khác để phân biệt.`;
      dupCriteria.push(no);
    } else seen.set(key, no);
    if (c.description.trim().length > MAX_DESCRIPTION_LENGTH) {
      errors[`${c.key}.description`] =
        `Mô tả tối đa ${MAX_DESCRIPTION_LENGTH} ký tự.`;
      emptyNames = true;
    }
    const cMax = toHundredths(c.maxScore);
    if (cMax === null) {
      errors[`${c.key}.maxScore`] =
        'Nhập điểm là số, tối đa hai chữ số thập phân.';
      badScores.push(String(no));
    } else if (cMax === 0) zero.push(String(no));

    const seenSubs = new Set<string>();
    c.subCriteria.forEach((s, j) => {
      const subKey = nameKey(s.name);
      if (!subKey) {
        errors[`${s.key}.name`] = 'Nhập tên hạng mục con.';
        emptyNames = true;
      } else if (s.name.trim().length > MAX_NAME_LENGTH) {
        errors[`${s.key}.name`] = `Tên tối đa ${MAX_NAME_LENGTH} ký tự.`;
        emptyNames = true;
      } else if (seenSubs.has(subKey)) {
        errors[`${s.key}.name`] =
          'Trùng tên với hạng mục khác trong tiêu chí này.';
        dupSubs = true;
      }
      seenSubs.add(subKey);
      const sMax = toHundredths(s.maxScore);
      if (sMax === null) {
        errors[`${s.key}.maxScore`] =
          'Nhập điểm là số, tối đa hai chữ số thập phân.';
        badScores.push(`${no}.${j + 1}`);
      } else if (sMax === 0) zero.push(`${no}.${j + 1}`);
    });

    if (c.subCriteria.length === 0) {
      errors[`${c.key}.total`] = 'Tiêu chí phải có ít nhất một hạng mục con.';
      mismatch.push(no);
    } else if (subTotal(c) !== cMax) {
      errors[`${c.key}.total`] = 'mismatch';
      mismatch.push(no);
    }
  });

  if (badScores.length)
    blocking.push(`Điểm không hợp lệ ở mục ${badScores.join(', ')}.`);
  if (dupCriteria.length)
    blocking.push(
      `Tên tiêu chí bị trùng ở tiêu chí ${dupCriteria.join(', ')}.`,
    );
  if (dupSubs) blocking.push('Có hạng mục con trùng tên trong cùng tiêu chí.');
  if (emptyNames)
    blocking.push('Còn tiêu chí hoặc hạng mục chưa có tên hoặc quá dài.');

  if (mismatch.length)
    incomplete.push(
      `Tổng hạng mục con chưa khớp điểm tiêu chí ở tiêu chí ${mismatch.join(', ')}.`,
    );
  if (zero.length)
    incomplete.push(`Điểm tối đa phải lớn hơn 0 ở mục ${zero.join(', ')}.`);

  return {
    errors,
    blocking: blocking.join(' '),
    incomplete: incomplete.join(' '),
  };
}

// Trạng thái lưu theo nội dung: đủ điều kiện thì Active, chưa đủ thì Nháp.
export const statusOf = (check: TemplateCheck): TemplateStatus =>
  check.incomplete ? 'Draft' : 'Active';

const toNumber = (value: string) => (toHundredths(value) ?? 0) / 100;

export const draftToInput = (
  draft: TemplateDraft,
  status: TemplateStatus,
): TemplateInput => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  maxScore: TEMPLATE_SCALE,
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
