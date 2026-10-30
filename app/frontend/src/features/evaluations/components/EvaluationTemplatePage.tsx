'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AssignmentSection } from '@/features/evaluations/components/AssignmentSection';
import { TemplateEditor } from '@/features/evaluations/components/TemplateEditor';
import {
  evaluationService as defaultEvaluationService,
  TemplateInUseError,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import {
  newDraft,
  type TemplateDraft,
} from '@/features/evaluations/templateValidation';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { useUrlParam } from '@/lib/useUrlParam';
import {
  GRADING_ROLE_LABEL,
  type EvaluationTemplate,
  type TemplateStatus,
} from '@/types/evaluation';
import type { Round } from '@/types/round';

interface EvaluationTemplatePageProps {
  evaluationService?: EvaluationService;
  roundService?: RoundService;
}

// Mẫu đang chọn: một mẫu đã lưu, hoặc mẫu mới chưa lưu (kèm bản nháp ban đầu).
type Selection =
  | { kind: 'saved'; id: string }
  | { kind: 'new'; draft: TemplateDraft; seq: number }
  | null;

type Dialog =
  | { kind: 'remove'; templateId: string }
  | { kind: 'status'; templateId: string; status: TemplateStatus }
  | { kind: 'discard'; next: Selection }
  | null;

const PAGE_SIZE = 4;

const countSubs = (t: EvaluationTemplate) =>
  t.criteria.reduce((n, c) => n + c.subCriteria.length, 0);

// Màn Mẫu phiếu đánh giá của Giáo vụ theo artboard GiaoVu-PhieuDanhGia: khối gán
// mẫu cho ba vai trò chấm của đợt, danh sách thẻ mẫu (4 mẫu/trang) và trình sửa
// mẫu đặt bên phải.
export const EvaluationTemplatePage: React.FC<EvaluationTemplatePageProps> = ({
  evaluationService = defaultEvaluationService,
  roundService = defaultRoundService,
}) => {
  const [roundParam, setRoundParam] = useUrlParam('dot');
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [newSeq, setNewSeq] = useState(0);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, roundList] = await Promise.all([
        evaluationService.list(),
        roundService.list(),
      ]);
      setTemplates(list);
      setRounds(roundList);
      setSelection(
        (s) => s ?? (list[0] ? { kind: 'saved', id: list[0].id } : null),
      );
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Không tải được mẫu phiếu.',
      );
    } finally {
      setLoading(false);
    }
  }, [evaluationService, roundService]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshTemplates = useCallback(() => {
    evaluationService
      .list()
      .then(setTemplates)
      .catch(() => {
        // Nhãn "Đang gán" chỉ để tham khảo; lỗi tải lại không chặn thao tác.
      });
  }, [evaluationService]);

  const round =
    rounds.find((r) => r.id === roundParam) ??
    rounds.find((r) => r.status === 'Đang diễn ra') ??
    rounds[0] ??
    null;
  const roundName = (id: string) =>
    rounds.find((r) => r.id === id)?.name ?? `Đợt ${id}`;

  const selected =
    selection?.kind === 'saved'
      ? templates.find((t) => t.id === selection.id)
      : undefined;

  // Mẫu mới chưa lưu nằm cuối danh sách như trên design.
  const cardCount = templates.length + (selection?.kind === 'new' ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(cardCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = templates.slice(start, start + PAGE_SIZE);
  const showNewCard =
    selection?.kind === 'new' &&
    templates.length >= start &&
    templates.length < start + PAGE_SIZE;

  const otherNames = useMemo(
    () => templates.filter((t) => t.id !== selected?.id).map((t) => t.name),
    [templates, selected?.id],
  );

  const rolesInRound = (t: EvaluationTemplate) =>
    t.assignments
      .filter((a) => a.roundId === round?.id)
      .map((a) => GRADING_ROLE_LABEL[a.role]);
  const usageText = (t: EvaluationTemplate) =>
    t.assignments.map(
      (a) => `${roundName(a.roundId)} · ${GRADING_ROLE_LABEL[a.role]}`,
    );

  const chipOf = (t: EvaluationTemplate) => {
    const roles = rolesInRound(t);
    if (t.status === 'Closed')
      return {
        text: roles.length
          ? `Đã đóng · đang gán: ${roles.join(', ')}`
          : 'Đã đóng',
        className: 'app-chip-disabled',
      };
    if (t.status === 'Draft')
      return { text: 'Nháp', className: 'app-chip-pending' };
    return {
      text: roles.length ? `Đang gán: ${roles.join(', ')}` : 'Đang dùng',
      className: 'app-chip-active',
    };
  };

  // Đổi mẫu khi đang có thay đổi chưa lưu thì hỏi trước.
  const select = (next: Selection) => {
    if (dirty) {
      setDialog({ kind: 'discard', next });
      return;
    }
    setNotice(null);
    setDirty(false);
    setSelection(next);
  };

  const startNew = (draft = newDraft()) => {
    const seq = newSeq + 1;
    setNewSeq(seq);
    select({ kind: 'new', draft, seq });
    if (!dirty) setPage(Math.ceil((templates.length + 1) / PAGE_SIZE));
  };

  const replace = (saved: EvaluationTemplate) =>
    setTemplates((list) =>
      list.some((t) => t.id === saved.id)
        ? list.map((t) => (t.id === saved.id ? saved : t))
        : [...list, saved],
    );

  const handleSaved = (saved: EvaluationTemplate, mode: 'create' | 'edit') => {
    replace(saved);
    if (mode === 'create') {
      setDirty(false);
      setSelection({ kind: 'saved', id: saved.id });
      setNotice(`Đã tạo mẫu phiếu ${saved.name} ở trạng thái Nháp.`);
      toast.success('Đã tạo mẫu phiếu.');
    } else {
      toast.success('Đã lưu mẫu phiếu.');
    }
  };

  const closeDialog = useCallback(() => {
    setDialog(null);
    setActionError(null);
  }, []);

  const runDialogAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error && err.message
          ? err.message
          : 'Thao tác thất bại. Thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (template: EvaluationTemplate) =>
    runDialogAction(async () => {
      const roles = usageText(template);
      try {
        await evaluationService.remove(template.id, {
          removeAssignments: roles.length > 0,
        });
      } catch (err) {
        // Có thể vừa được gán ở nơi khác: tải lại để hộp xác nhận nêu đúng.
        if (err instanceof TemplateInUseError) refreshTemplates();
        throw err;
      }
      const rest = templates.filter((t) => t.id !== template.id);
      setTemplates(rest);
      setDirty(false);
      setSelection(rest[0] ? { kind: 'saved', id: rest[0].id } : null);
      setDialog(null);
      setNotice(
        `Đã xóa ${template.name}.` +
          (roles.length ? ` Cần gán mẫu khác cho ${roles.join('; ')}.` : ''),
      );
    });

  const confirmStatus = (
    template: EvaluationTemplate,
    status: TemplateStatus,
  ) =>
    runDialogAction(async () => {
      const saved = await evaluationService.setStatus(template.id, status);
      replace(saved);
      setDialog(null);
      toast.success(
        status === 'Closed'
          ? 'Đã đóng mẫu phiếu.'
          : template.status === 'Draft'
            ? 'Mẫu phiếu đã chuyển sang đang dùng.'
            : 'Mẫu phiếu đã được dùng lại.',
      );
    });

  const dialogTemplate =
    dialog && dialog.kind !== 'discard'
      ? templates.find((t) => t.id === dialog.templateId)
      : undefined;

  const copyName = (name: string) => {
    let candidate = `${name} (bản sao)`;
    for (let n = 2; templates.some((t) => t.name === candidate); n += 1)
      candidate = `${name} (bản sao ${n})`;
    return candidate;
  };

  return (
    <>
      <div className="app-page-heading">
        <div className="app-heading-row eval-heading">
          <div className="eval-heading-text">
            <span className="app-muted eval-breadcrumb">
              Phiếu đánh giá / Mẫu phiếu
            </span>
            <h1>Mẫu phiếu đánh giá</h1>
            <p>
              Mỗi vai trò chấm dùng một mẫu phiếu riêng. Giáo vụ tạo mẫu rồi gán
              cho vai trò trong đợt. Khi chấm, phiếu có một cột điểm cho mỗi
              sinh viên trong nhóm (1 hoặc 2 sinh viên).
            </p>
          </div>
          <button
            type="button"
            className="app-button app-button-primary"
            disabled={loading || !!loadError}
            onClick={() => startNew()}
          >
            Tạo mẫu phiếu
          </button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="app-muted">
          Đang tải mẫu phiếu...
        </p>
      ) : loadError ? (
        <section className="status-state" role="alert">
          <h2>Không tải được mẫu phiếu</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className="app-button"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </section>
      ) : (
        <>
          <AssignmentSection
            rounds={rounds}
            round={round}
            templates={templates}
            evaluationService={evaluationService}
            onSelectRound={(id) => setRoundParam(id, 'replace')}
            onChanged={refreshTemplates}
          />

          <div className="eval-layout">
            <div className="eval-list-column">
              <div
                role="list"
                aria-label="Danh sách mẫu phiếu"
                className="eval-list"
              >
                {visible.map((t) => {
                  const chip = chipOf(t);
                  const current =
                    selection?.kind === 'saved' && selection.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="listitem"
                      aria-current={current ? 'true' : undefined}
                      className={
                        current ? 'eval-card eval-card-current' : 'eval-card'
                      }
                      onClick={() =>
                        !current && select({ kind: 'saved', id: t.id })
                      }
                    >
                      <span className="eval-card-name">{t.name}</span>
                      <span className="app-muted eval-small">
                        {t.criteria.length} tiêu chí chung · {countSubs(t)} hạng
                        mục con
                      </span>
                      <span className={`app-chip ${chip.className}`}>
                        {chip.text}
                      </span>
                    </button>
                  );
                })}
                {showNewCard && selection?.kind === 'new' && (
                  <button
                    type="button"
                    role="listitem"
                    aria-current="true"
                    className="eval-card eval-card-current"
                  >
                    <span className="eval-card-name">
                      Mẫu phiếu mới (chưa lưu)
                    </span>
                    <span className="app-muted eval-small">
                      {selection.draft.criteria.length} tiêu chí chung
                    </span>
                    <span className="app-chip app-chip-pending">Nháp</span>
                  </button>
                )}
                {cardCount === 0 && (
                  <p className="app-muted">
                    Chưa có mẫu phiếu. Chọn Tạo mẫu phiếu để bắt đầu.
                  </p>
                )}
              </div>
              {cardCount > 0 && (
                <nav
                  aria-label="Phân trang mẫu phiếu"
                  className="eval-pagination"
                >
                  <span>
                    {start + 1}–{Math.min(start + PAGE_SIZE, cardCount)} trên{' '}
                    {cardCount} mẫu
                  </span>
                  <span className="eval-pagination-controls">
                    <button
                      type="button"
                      className="app-icon-button"
                      aria-label="Trang trước"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={15} aria-hidden="true" />
                    </button>
                    <span className="eval-page-label">
                      Trang {currentPage} / {pageCount}
                    </span>
                    <button
                      type="button"
                      className="app-icon-button"
                      aria-label="Trang sau"
                      disabled={currentPage >= pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </span>
                </nav>
              )}
            </div>

            <div className="eval-editor-column">
              {notice && (
                <span role="status" className="eval-status-ok">
                  {notice}
                </span>
              )}
              {selection?.kind === 'new' ? (
                <TemplateEditor
                  key={`new-${selection.seq}`}
                  initialDraft={selection.draft}
                  otherNames={otherNames}
                  usage={[]}
                  evaluationService={evaluationService}
                  onDirtyChange={setDirty}
                  onSaved={handleSaved}
                  onDiscardNew={() => {
                    setDirty(false);
                    setSelection(
                      templates[0]
                        ? { kind: 'saved', id: templates[0].id }
                        : null,
                    );
                    setNotice('Đã hủy tạo mẫu phiếu mới.');
                  }}
                  onRemove={() => undefined}
                  onChangeStatus={() => undefined}
                  onCopy={() => undefined}
                />
              ) : selected ? (
                <TemplateEditor
                  key={selected.id}
                  template={selected}
                  otherNames={otherNames}
                  usage={usageText(selected)}
                  evaluationService={evaluationService}
                  onDirtyChange={setDirty}
                  onSaved={handleSaved}
                  onDiscardNew={() => undefined}
                  onRemove={() =>
                    setDialog({ kind: 'remove', templateId: selected.id })
                  }
                  onChangeStatus={(status) =>
                    setDialog({
                      kind: 'status',
                      templateId: selected.id,
                      status,
                    })
                  }
                  onCopy={(draft) =>
                    startNew({ ...draft, name: copyName(draft.name) })
                  }
                />
              ) : (
                <section className="status-state app-empty">
                  <h2>Chưa chọn mẫu phiếu</h2>
                  <p>Chọn một mẫu ở danh sách hoặc tạo mẫu mới.</p>
                </section>
              )}
            </div>
          </div>
        </>
      )}

      {dialog?.kind === 'discard' && (
        <ConfirmDialog
          title="Bỏ thay đổi chưa lưu?"
          description="Mẫu đang sửa có thay đổi chưa lưu. Nếu chuyển sang mẫu khác, các thay đổi này sẽ mất."
          cancelLabel="Tiếp tục sửa"
          confirmLabel="Bỏ thay đổi"
          danger
          onCancel={closeDialog}
          onConfirm={() => {
            const next = dialog.next;
            closeDialog();
            setDirty(false);
            setNotice(null);
            setSelection(next);
            if (next?.kind === 'new')
              setPage(Math.ceil((templates.length + 1) / PAGE_SIZE));
          }}
        />
      )}

      {dialog?.kind === 'remove' && dialogTemplate && (
        <ConfirmDialog
          title={`Xóa ${dialogTemplate.name}?`}
          description={
            dialogTemplate.assignments.length > 0
              ? `Mẫu đang gán cho ${usageText(dialogTemplate).join('; ')} nhưng chưa có điểm nên xóa được. Sau khi xóa, vai trò này chưa có mẫu phiếu và cần gán mẫu khác trước khi chấm. Thao tác này không hoàn tác được.`
              : 'Mẫu chưa gán cho vai trò nào và chưa có điểm nên xóa được. Thao tác này không hoàn tác được.'
          }
          cancelLabel="Hủy"
          confirmLabel="Xóa mẫu phiếu"
          danger
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => void confirmRemove(dialogTemplate)}
        />
      )}

      {dialog?.kind === 'status' && dialogTemplate && (
        <ConfirmDialog
          title={
            dialog.status === 'Closed'
              ? `Đóng mẫu "${dialogTemplate.name}"?`
              : dialogTemplate.status === 'Draft'
                ? `Chuyển mẫu "${dialogTemplate.name}" sang đang dùng?`
                : `Dùng lại mẫu "${dialogTemplate.name}"?`
          }
          description={
            dialog.status === 'Closed'
              ? 'Mẫu đã đóng không sửa được và không gán được cho đợt mới; các đợt đang dùng mẫu vẫn giữ nguyên. Có thể dùng lại sau.'
              : dialogTemplate.status === 'Draft'
                ? 'Sau khi dùng, mẫu gán được cho vai trò chấm trong đợt và không quay lại nháp.'
                : 'Mẫu sẽ sửa được và gán được cho các đợt trở lại.'
          }
          cancelLabel="Hủy"
          confirmLabel={
            dialog.status === 'Closed'
              ? 'Đóng mẫu'
              : dialogTemplate.status === 'Draft'
                ? 'Chuyển sang đang dùng'
                : 'Dùng lại'
          }
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => void confirmStatus(dialogTemplate, dialog.status)}
        />
      )}
    </>
  );
};
