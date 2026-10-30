'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DuplicateTemplateNameError,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import {
  checkTemplate,
  criteriaTotal,
  draftFromTemplate,
  draftToInput,
  formatScore,
  MAX_DESCRIPTION_LENGTH,
  newCriterion,
  newDraft,
  newSub,
  sameDraft,
  subTotal,
  toHundredths,
  type DraftCriterion,
  type TemplateDraft,
} from '@/features/evaluations/templateValidation';
import type { EvaluationTemplate, TemplateStatus } from '@/types/evaluation';

interface TemplateEditorProps {
  // template có giá trị = sửa mẫu đã lưu; không có = mẫu mới chưa lưu.
  template?: EvaluationTemplate;
  // Bản nháp ban đầu cho mẫu mới (ví dụ bản sao của một mẫu).
  initialDraft?: TemplateDraft;
  otherNames: string[];
  // Vai trò đang dùng mẫu (để ghi chú và cảnh báo khi xóa).
  usage: string[];
  evaluationService: EvaluationService;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (template: EvaluationTemplate, mode: 'create' | 'edit') => void;
  onDiscardNew: () => void;
  onRemove: () => void;
  onChangeStatus: (status: TemplateStatus) => void;
  onCopy: (draft: TemplateDraft) => void;
}

const invalid = (id: string, error?: string) =>
  error
    ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
    : {};

const FieldError: React.FC<{ id: string; error?: string }> = ({ id, error }) =>
  error ? (
    <span id={`${id}-error`} className="eval-field-error">
      {error}
    </span>
  ) : null;

// Trình sửa mẫu phiếu đặt ngay trên trang theo artboard GiaoVu-PhieuDanhGia:
// bảng STT · Tiêu chí chung · hạng mục con · Điểm tối đa, kiểm tổng điểm trực
// tiếp, xem trước cột điểm SV1/SV2 và thanh thao tác Xóa / Hủy / Lưu.
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  initialDraft,
  otherNames,
  usage,
  evaluationService,
  onDirtyChange,
  onSaved,
  onDiscardNew,
  onRemove,
  onChangeStatus,
  onCopy,
}) => {
  const isNew = !template;
  const status: TemplateStatus = template?.status ?? 'Draft';
  const closed = status === 'Closed';
  const [base, setBase] = useState<TemplateDraft>(() =>
    template ? draftFromTemplate(template) : (initialDraft ?? newDraft()),
  );
  const [draft, setDraft] = useState<TemplateDraft>(base);
  const [serverNameError, setServerNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const savingRef = useRef(false);

  const dirty = isNew || !sameDraft(draft, base);
  useEffect(
    () => onDirtyChange(dirty && !closed),
    [dirty, closed, onDirtyChange],
  );

  const { errors, summary } = useMemo(
    () => checkTemplate(draft, otherNames),
    [draft, otherNames],
  );
  const nameError = errors.name ?? serverNameError ?? undefined;
  const scale = toHundredths(draft.maxScore) ?? 1000;
  const total = criteriaTotal(draft);

  const change = (update: (d: TemplateDraft) => TemplateDraft) => {
    setDraft(update);
    setMessage(null);
    setSaveError(null);
  };
  const patchCriterion = (
    index: number,
    update: (c: DraftCriterion) => DraftCriterion,
  ) =>
    change((d) => ({
      ...d,
      criteria: d.criteria.map((c, i) => (i === index ? update(c) : c)),
    }));

  const save = async () => {
    if (savingRef.current || summary || closed) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = draftToInput(draft, status);
      const saved = template
        ? await evaluationService.update(template.id, input)
        : await evaluationService.create(input);
      if (template) {
        setBase(draft);
        // Báo ngay cho trang, không chờ effect, để chuyển mẫu không bị hỏi lại.
        onDirtyChange(false);
        setMessage(
          'Đã lưu mẫu phiếu. Phiếu đang gán sẽ dùng bản mới cho lần chấm tiếp theo.',
        );
      }
      onSaved(saved, template ? 'edit' : 'create');
    } catch (err: unknown) {
      if (err instanceof DuplicateTemplateNameError)
        setServerNameError(err.message);
      else
        setSaveError(
          err instanceof Error && err.message
            ? err.message
            : 'Lưu mẫu phiếu thất bại. Thử lại sau.',
        );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const cancel = () => {
    if (isNew) {
      onDiscardNew();
      return;
    }
    setDraft(base);
    onDirtyChange(false);
    setServerNameError(null);
    setSaveError(null);
    setMessage('Đã hủy thay đổi, mẫu phiếu trở lại bản đã lưu.');
  };

  const first = draft.criteria[0];
  const firstSub = first?.subCriteria[0];
  const previewName = first
    ? `1.1. ${firstSub ? firstSub.name : first.name}`
    : '—';
  const previewMax = first
    ? formatScore(toHundredths((firstSub ?? first).maxScore) ?? 0)
    : '—';
  const removingCriterion = removing === null ? null : draft.criteria[removing];

  return (
    <section
      className="app-card eval-editor"
      aria-labelledby="eval-editor-title"
    >
      <h2 id="eval-editor-title" className="app-visually-hidden">
        {isNew ? 'Tạo mẫu phiếu' : 'Chỉnh sửa mẫu phiếu'}
      </h2>
      <fieldset disabled={closed} className="eval-editor-fields">
        <div className="eval-head-grid">
          <div className="eval-field">
            <label htmlFor="tp-name">Tên mẫu phiếu</label>
            <input
              id="tp-name"
              value={draft.name}
              onChange={(e) => {
                setServerNameError(null);
                change((d) => ({ ...d, name: e.target.value }));
              }}
              {...invalid('tp-name', nameError)}
            />
            <FieldError id="tp-name" error={nameError} />
          </div>
          <div className="eval-field">
            <span className="eval-label">Thang điểm</span>
            <span className="eval-readonly">{formatScore(scale)} điểm</span>
          </div>
        </div>

        <div className="eval-field">
          <label htmlFor="tp-desc">
            Mô tả <span className="eval-optional">(không bắt buộc)</span>
          </label>
          <textarea
            id="tp-desc"
            rows={2}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="Mẫu dùng cho vai trò nào, lưu ý chung khi chấm"
            value={draft.description}
            onChange={(e) =>
              change((d) => ({ ...d, description: e.target.value }))
            }
          />
        </div>

        {closed && (
          <div role="note" className="eval-note eval-note-warn">
            Mẫu này đã đóng: không sửa được và không gán được cho đợt mới; các
            đợt đang dùng mẫu giữ nguyên. Muốn thay đổi, chọn Tạo bản sao để có
            một mẫu Nháp mới, hoặc Dùng lại mẫu.
          </div>
        )}
        {status === 'Draft' && (
          <div role="note" className="eval-note">
            Mẫu Nháp: chưa dùng để chấm nên sửa hoặc xóa được. Chuyển sang đang
            dùng để gán cho vai trò chấm trong đợt.
          </div>
        )}
        {status === 'Active' && usage.length > 0 && (
          <div role="note" className="eval-note">
            Đang gán cho: {usage.join('; ')}.
          </div>
        )}

        <div
          className="eval-table"
          role="group"
          aria-label="Tiêu chí chung và hạng mục con"
        >
          <div className="eval-grid eval-grid-head" aria-hidden="true">
            <span>STT</span>
            <span>Tiêu chí chung · hạng mục con</span>
            <span>Điểm tối đa</span>
            <span />
          </div>

          {draft.criteria.map((c, i) => {
            const no = i + 1;
            const cMax = toHundredths(c.maxScore);
            const sum = subTotal(c);
            const ok = c.subCriteria.length > 0 && sum === cMax;
            const nameId = `${c.key}-name`;
            const maxId = `${c.key}-max`;
            return (
              <React.Fragment key={c.key}>
                <div className="eval-grid eval-grid-criterion">
                  <span className="eval-no">{no}.</span>
                  <span className="eval-cell">
                    <input
                      aria-label={`Tên tiêu chí chung ${no}`}
                      className="eval-input-strong"
                      value={c.name}
                      onChange={(e) =>
                        patchCriterion(i, (x) => ({
                          ...x,
                          name: e.target.value,
                        }))
                      }
                      {...invalid(nameId, errors[`${c.key}.name`])}
                    />
                    <FieldError id={nameId} error={errors[`${c.key}.name`]} />
                    <input
                      aria-label={`Mô tả tiêu chí ${no}`}
                      className="eval-input-desc"
                      placeholder="Mô tả, hướng dẫn chấm (không bắt buộc)"
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      value={c.description}
                      onChange={(e) =>
                        patchCriterion(i, (x) => ({
                          ...x,
                          description: e.target.value,
                        }))
                      }
                    />
                  </span>
                  <span className="eval-cell">
                    <input
                      aria-label={`Điểm tối đa tiêu chí ${no}`}
                      type="number"
                      min="0"
                      max="10"
                      step="0.25"
                      className="eval-input-strong"
                      value={c.maxScore}
                      onChange={(e) =>
                        patchCriterion(i, (x) => ({
                          ...x,
                          maxScore: e.target.value,
                        }))
                      }
                      {...invalid(maxId, errors[`${c.key}.maxScore`])}
                    />
                    <FieldError
                      id={maxId}
                      error={errors[`${c.key}.maxScore`]}
                    />
                  </span>
                  <button
                    type="button"
                    className="eval-remove"
                    aria-label={`Xóa tiêu chí ${no}`}
                    aria-haspopup="dialog"
                    onClick={() => setRemoving(i)}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {c.subCriteria.map((s, j) => {
                  const sNo = `${no}.${j + 1}`;
                  const sNameId = `${s.key}-name`;
                  const sMaxId = `${s.key}-max`;
                  const patchSub = (
                    field: 'name' | 'maxScore',
                    value: string,
                  ) =>
                    patchCriterion(i, (x) => ({
                      ...x,
                      subCriteria: x.subCriteria.map((y, k) =>
                        k === j ? { ...y, [field]: value } : y,
                      ),
                    }));
                  return (
                    <div key={s.key} className="eval-grid eval-grid-sub">
                      <span className="eval-no eval-no-sub">{sNo}.</span>
                      <span className="eval-cell">
                        <input
                          aria-label={`Hạng mục ${sNo}`}
                          value={s.name}
                          onChange={(e) => patchSub('name', e.target.value)}
                          {...invalid(sNameId, errors[`${s.key}.name`])}
                        />
                        <FieldError
                          id={sNameId}
                          error={errors[`${s.key}.name`]}
                        />
                      </span>
                      <span className="eval-cell">
                        <input
                          aria-label={`Điểm tối đa hạng mục ${sNo}`}
                          type="number"
                          min="0"
                          max="10"
                          step="0.25"
                          value={s.maxScore}
                          onChange={(e) => patchSub('maxScore', e.target.value)}
                          {...invalid(sMaxId, errors[`${s.key}.maxScore`])}
                        />
                        <FieldError
                          id={sMaxId}
                          error={errors[`${s.key}.maxScore`]}
                        />
                      </span>
                      <button
                        type="button"
                        className="eval-remove"
                        aria-label={`Xóa hạng mục ${sNo}`}
                        onClick={() =>
                          patchCriterion(i, (x) => ({
                            ...x,
                            subCriteria: x.subCriteria.filter(
                              (_, k) => k !== j,
                            ),
                          }))
                        }
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                <div className="eval-criterion-footer">
                  <button
                    type="button"
                    className="eval-link-button"
                    onClick={() =>
                      patchCriterion(i, (x) => ({
                        ...x,
                        subCriteria: [...x.subCriteria, newSub()],
                      }))
                    }
                  >
                    + Thêm hạng mục con
                  </button>
                  <span className={ok ? 'eval-check-ok' : 'eval-check-bad'}>
                    {c.subCriteria.length === 0
                      ? 'Chưa có hạng mục con'
                      : ok
                        ? `Tổng hạng mục con: ${formatScore(sum)} = ${formatScore(cMax ?? 0)}`
                        : `Tổng hạng mục con ${formatScore(sum)} khác ${formatScore(cMax ?? 0)}`}
                  </span>
                </div>
              </React.Fragment>
            );
          })}

          <div
            className={
              total === scale && draft.criteria.length > 0
                ? 'eval-table-footer eval-total-ok'
                : 'eval-table-footer eval-total-bad'
            }
          >
            <button
              type="button"
              className="app-button app-button-small"
              onClick={() =>
                change((d) => ({
                  ...d,
                  criteria: [...d.criteria, newCriterion()],
                }))
              }
            >
              + Thêm tiêu chí chung
            </button>
            <span className="eval-total">
              Tổng tiêu chí chung: {formatScore(total)} / {formatScore(scale)}
            </span>
          </div>
        </div>

        {summary && !closed && (
          <span role="alert" className="eval-summary">
            {summary}
          </span>
        )}
      </fieldset>

      <div className="eval-preview">
        <span className="eval-label">Xem trước khi chấm</span>
        <div className="eval-preview-grid">
          <span>Tiêu chí</span>
          <span>Tối đa</span>
          <span>Điểm SV1</span>
          <span>Điểm SV2</span>
          <span className="eval-preview-name">{previewName}</span>
          <span>{previewMax}</span>
          <span>…/{previewMax}</span>
          <span>…/{previewMax}</span>
        </div>
        <span className="app-muted eval-small">
          Nhóm 1 sinh viên thì phiếu chỉ có cột Điểm SV1.
        </span>
      </div>

      <div className="eval-actions">
        {!isNew && (
          <button
            type="button"
            className="app-button eval-delete"
            aria-haspopup="dialog"
            onClick={onRemove}
          >
            Xóa mẫu phiếu
          </button>
        )}
        {status === 'Draft' && !isNew && (
          <button
            type="button"
            className="app-button"
            aria-haspopup="dialog"
            disabled={dirty}
            title={
              dirty ? 'Lưu thay đổi trước khi chuyển trạng thái.' : undefined
            }
            onClick={() => onChangeStatus('Active')}
          >
            Chuyển sang đang dùng
          </button>
        )}
        {status === 'Active' && (
          <button
            type="button"
            className="app-button"
            aria-haspopup="dialog"
            onClick={() => onChangeStatus('Closed')}
          >
            Đóng mẫu
          </button>
        )}
        {closed && (
          <>
            <button
              type="button"
              className="app-button eval-copy"
              onClick={() => onCopy(draft)}
            >
              Tạo bản sao
            </button>
            <button
              type="button"
              className="app-button"
              aria-haspopup="dialog"
              onClick={() => onChangeStatus('Active')}
            >
              Dùng lại mẫu
            </button>
          </>
        )}
        {message && (
          <span role="status" className="eval-status-ok">
            {message}
          </span>
        )}
        {saveError && (
          <span role="alert" className="eval-summary">
            {saveError}
          </span>
        )}
        {dirty && !closed && (
          <button
            type="button"
            className="app-button"
            disabled={saving}
            onClick={cancel}
          >
            {isNew ? 'Hủy tạo mẫu' : 'Hủy thay đổi'}
          </button>
        )}
        {!closed && (
          <button
            type="button"
            className="app-button app-button-primary"
            disabled={saving || !!summary || !dirty}
            aria-busy={saving}
            onClick={() => void save()}
          >
            {saving ? 'Đang lưu...' : 'Lưu mẫu phiếu'}
          </button>
        )}
      </div>

      {removingCriterion && removing !== null && (
        <ConfirmDialog
          title={`Xóa tiêu chí ${removing + 1}. ${removingCriterion.name.trim() || 'chưa đặt tên'}?`}
          description={`Tiêu chí này và ${removingCriterion.subCriteria.length} hạng mục con sẽ bị xóa khỏi mẫu. Sau khi xóa, chỉnh lại điểm để tổng các tiêu chí chung bằng ${formatScore(scale)} rồi mới lưu được. Chưa lưu thì vẫn bấm Hủy thay đổi để lấy lại.`}
          cancelLabel="Hủy"
          confirmLabel="Xóa tiêu chí"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const index = removing;
            setRemoving(null);
            change((d) => ({
              ...d,
              criteria: d.criteria.filter((_, k) => k !== index),
            }));
          }}
        />
      )}
    </section>
  );
};
