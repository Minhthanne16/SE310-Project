'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TemplateStateChip } from '@/features/evaluations/components/TemplateStatusChip';
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
  statusOf,
  subTotal,
  TEMPLATE_SCALE,
  toHundredths,
  type DraftCriterion,
  type TemplateDraft,
} from '@/features/evaluations/templateValidation';
import { useDialogFocus } from '@/lib/useDialogFocus';
import {
  TEMPLATE_STATE_LABEL,
  templateState,
  type EvaluationTemplate,
} from '@/types/evaluation';

export type DrawerMode = 'create' | 'view' | 'edit';

interface TemplateDrawerProps {
  mode: DrawerMode;
  // Mẫu đã lưu khi xem hoặc sửa; không có khi tạo mới.
  template?: EvaluationTemplate;
  // Bản nháp ban đầu khi tạo mới (đã có tên không trùng).
  initialDraft?: TemplateDraft;
  otherNames: string[];
  // Các đợt/vai trò đang dùng mẫu.
  usage: string[];
  evaluationService: EvaluationService;
  onClose: () => void;
  onSaved: (template: EvaluationTemplate, mode: 'create' | 'edit') => void;
  onRemove: () => void;
  // Tạm bỏ qua Escape khi trang mở hộp thoại xác nhận phía trên.
  escapeDisabled?: boolean;
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

// Panel bên phải để xem, tạo và sửa mẫu phiếu (artboard GiaoVu-PhieuDanhGia, phần
// trình sửa). Trạng thái lưu tự suy ra: tổng điểm chưa đủ thang 10 thì lưu là Nháp,
// đủ thì "Đủ điều kiện sử dụng"; gán cho đợt thì thành "Đang được sử dụng".
export const TemplateDrawer: React.FC<TemplateDrawerProps> = ({
  mode: initialMode,
  template,
  initialDraft,
  otherNames,
  usage,
  evaluationService,
  onClose,
  onSaved,
  onRemove,
  escapeDisabled = false,
}) => {
  const [mode, setMode] = useState<DrawerMode>(initialMode);
  const readOnly = mode === 'view';
  const isNew = !template;
  const [base] = useState<TemplateDraft>(() =>
    template ? draftFromTemplate(template) : (initialDraft ?? newDraft()),
  );
  const [draft, setDraft] = useState<TemplateDraft>(base);
  const [serverNameError, setServerNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingCriterion, setRemovingCriterion] = useState<number | null>(
    null,
  );
  // Hỏi bỏ thay đổi: 'close' = đóng panel, 'cancel' = quay lại chế độ xem.
  const [confirmClose, setConfirmClose] = useState<'close' | 'cancel' | null>(
    null,
  );
  const savingRef = useRef(false);
  const drawerRef = useDialogFocus<HTMLElement>();

  const dirty = !readOnly && !sameDraft(draft, base);
  const check = useMemo(
    () => checkTemplate(draft, otherNames),
    [draft, otherNames],
  );
  const nameError = check.errors.name ?? serverNameError ?? undefined;
  const nextStatus = statusOf(check);
  const inUse = !!template && templateState(template) === 'inuse';
  const keepValidError =
    inUse && check.incomplete
      ? `Mẫu đang được sử dụng nên phải giữ đủ điều kiện: ${check.incomplete}`
      : '';
  const blocked = !!check.blocking || !!keepValidError;
  // Mẫu cũ đã lưu Nháp nhưng nay đủ điều kiện (hoặc ngược lại) vẫn cho lưu để cập nhật trạng thái.
  const statusChanged = !!template && template.status !== nextStatus;
  const total = criteriaTotal(draft);
  const scale = TEMPLATE_SCALE * 100;

  const requestClose = () => {
    if (savingRef.current) return;
    if (dirty) setConfirmClose('close');
    else onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  const blockEscape =
    escapeDisabled || confirmClose !== null || removingCriterion !== null;
  const blockEscapeRef = useRef(blockEscape);
  blockEscapeRef.current = blockEscape;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blockEscapeRef.current)
        requestCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const change = (update: (d: TemplateDraft) => TemplateDraft) => {
    setDraft(update);
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
    if (savingRef.current || blocked || readOnly) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = draftToInput(draft, nextStatus);
      const saved = template
        ? await evaluationService.update(template.id, input)
        : await evaluationService.create(input);
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

  const cancelEdit = () => {
    if (isNew) {
      requestClose();
      return;
    }
    if (dirty) setConfirmClose('cancel');
    else setMode('view');
  };

  const first = draft.criteria[0];
  const firstSub = first?.subCriteria[0];
  const previewName = first
    ? `1.1. ${firstSub ? firstSub.name : first.name}`
    : '—';
  const previewMax = first
    ? formatScore(toHundredths((firstSub ?? first).maxScore) ?? 0)
    : '—';
  const removing =
    removingCriterion === null ? null : draft.criteria[removingCriterion];

  const title =
    mode === 'create'
      ? 'Tạo mẫu phiếu'
      : mode === 'edit'
        ? 'Sửa mẫu phiếu'
        : 'Chi tiết mẫu phiếu';
  const savedState = template ? templateState(template) : 'draft';

  return (
    <div
      className="app-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-drawer-title"
        className="app-drawer eval-drawer"
      >
        <header className="app-drawer-header">
          <div className="eval-drawer-title">
            <h2 id="template-drawer-title">{title}</h2>
            {template && <TemplateStateChip template={template} />}
          </div>
          <button
            type="button"
            className="app-icon-button"
            aria-label="Đóng"
            onClick={requestClose}
            disabled={saving}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="app-drawer-body">
          <fieldset disabled={readOnly} className="eval-editor-fields">
            <div className="eval-field">
              <label htmlFor="tp-name">Tên mẫu phiếu</label>
              <input
                id="tp-name"
                value={draft.name}
                autoFocus={!readOnly}
                onChange={(e) => {
                  setServerNameError(null);
                  change((d) => ({ ...d, name: e.target.value }));
                }}
                {...invalid('tp-name', nameError)}
              />
              <FieldError id="tp-name" error={nameError} />
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

            {(!readOnly ? nextStatus === 'Draft' : savedState === 'draft') && (
              <div role="note" className="eval-note eval-note-warn">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>
                  Mẫu Nháp: chưa đủ điều kiện để chấm điểm nên sửa hoặc xóa
                  được. Điều chỉnh để tổng điểm các tiêu chí chung bằng{' '}
                  {formatScore(scale)} và mỗi tiêu chí khớp hạng mục con thì mẫu
                  đủ điều kiện sử dụng, rồi mới gán được cho vai trò chấm.
                </span>
              </div>
            )}
            {usage.length > 0 && (
              <div role="note" className="eval-note">
                Đang được sử dụng cho: {usage.join('; ')}. Thay đổi tiêu chí chỉ
                áp dụng cho lần chấm tiếp theo.
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
                          {...invalid(nameId, check.errors[`${c.key}.name`])}
                        />
                        <FieldError
                          id={nameId}
                          error={check.errors[`${c.key}.name`]}
                        />
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
                          inputMode="decimal"
                          className="eval-input-strong"
                          value={c.maxScore}
                          onChange={(e) =>
                            patchCriterion(i, (x) => ({
                              ...x,
                              maxScore: e.target.value,
                            }))
                          }
                          {...invalid(maxId, check.errors[`${c.key}.maxScore`])}
                        />
                        <FieldError
                          id={maxId}
                          error={check.errors[`${c.key}.maxScore`]}
                        />
                      </span>
                      <button
                        type="button"
                        className="eval-remove"
                        aria-label={`Xóa tiêu chí ${no}`}
                        aria-haspopup="dialog"
                        onClick={() => setRemovingCriterion(i)}
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
                              {...invalid(
                                sNameId,
                                check.errors[`${s.key}.name`],
                              )}
                            />
                            <FieldError
                              id={sNameId}
                              error={check.errors[`${s.key}.name`]}
                            />
                          </span>
                          <span className="eval-cell">
                            <input
                              aria-label={`Điểm tối đa hạng mục ${sNo}`}
                              inputMode="decimal"
                              value={s.maxScore}
                              onChange={(e) =>
                                patchSub('maxScore', e.target.value)
                              }
                              {...invalid(
                                sMaxId,
                                check.errors[`${s.key}.maxScore`],
                              )}
                            />
                            <FieldError
                              id={sMaxId}
                              error={check.errors[`${s.key}.maxScore`]}
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
                  Tổng tiêu chí chung: {formatScore(total)} /{' '}
                  {formatScore(scale)}
                </span>
              </div>
            </div>
          </fieldset>

          {!readOnly && (
            <p className="eval-save-hint" aria-live="polite">
              Lưu ra:{' '}
              <strong>
                {nextStatus === 'Draft'
                  ? TEMPLATE_STATE_LABEL.draft
                  : inUse
                    ? TEMPLATE_STATE_LABEL.inuse
                    : TEMPLATE_STATE_LABEL.ready}
              </strong>
            </p>
          )}
          {!readOnly && (check.blocking || keepValidError) && (
            <span role="alert" className="eval-summary">
              {[check.blocking, keepValidError].filter(Boolean).join(' ')}
            </span>
          )}
          {saveError && (
            <span role="alert" className="eval-summary">
              {saveError}
            </span>
          )}

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
        </div>

        <footer className="app-drawer-footer eval-drawer-footer">
          {!isNew && (
            <button
              type="button"
              className="app-button eval-delete"
              aria-haspopup="dialog"
              disabled={saving}
              onClick={onRemove}
            >
              Xóa mẫu phiếu
            </button>
          )}
          {readOnly ? (
            <>
              <button type="button" className="app-button" onClick={onClose}>
                Đóng
              </button>
              <button
                type="button"
                className="app-button app-button-primary"
                onClick={() => setMode('edit')}
              >
                Chỉnh sửa
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="app-button"
                disabled={saving}
                onClick={cancelEdit}
              >
                {isNew ? 'Hủy tạo mẫu' : 'Hủy'}
              </button>
              <button
                type="button"
                className="app-button app-button-primary"
                disabled={saving || blocked || (!dirty && !statusChanged)}
                aria-busy={saving}
                onClick={() => void save()}
              >
                {saving ? 'Đang lưu...' : 'Lưu mẫu phiếu'}
              </button>
            </>
          )}
        </footer>
      </aside>

      {removing && removingCriterion !== null && (
        <ConfirmDialog
          title={`Xóa tiêu chí ${removingCriterion + 1}. ${removing.name.trim() || 'chưa đặt tên'}?`}
          description={`Tiêu chí này và ${removing.subCriteria.length} hạng mục con sẽ bị xóa khỏi mẫu. Sau khi xóa, chỉnh lại điểm để tổng các tiêu chí chung bằng ${formatScore(scale)}, nếu không mẫu sẽ lưu thành Nháp. Chưa lưu thì vẫn bấm Hủy để lấy lại.`}
          cancelLabel="Hủy"
          confirmLabel="Xóa tiêu chí"
          danger
          onCancel={() => setRemovingCriterion(null)}
          onConfirm={() => {
            const index = removingCriterion;
            setRemovingCriterion(null);
            change((d) => ({
              ...d,
              criteria: d.criteria.filter((_, k) => k !== index),
            }));
          }}
        />
      )}

      {confirmClose !== null && (
        <ConfirmDialog
          title="Bỏ thay đổi chưa lưu?"
          description="Mẫu phiếu có thay đổi chưa lưu. Nếu đóng, các thay đổi này sẽ mất."
          cancelLabel="Tiếp tục sửa"
          confirmLabel="Bỏ thay đổi"
          danger
          onCancel={() => setConfirmClose(null)}
          onConfirm={() => {
            const kind = confirmClose;
            setConfirmClose(null);
            if (kind === 'close') {
              onClose();
              return;
            }
            setDraft(base);
            setServerNameError(null);
            setSaveError(null);
            setMode('view');
          }}
        />
      )}
    </div>
  );
};
