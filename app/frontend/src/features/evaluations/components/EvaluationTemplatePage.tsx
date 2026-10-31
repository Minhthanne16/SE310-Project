'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RoundAssignmentList } from '@/features/evaluations/components/RoundAssignmentList';
import {
  TemplateDrawer,
  type DrawerMode,
} from '@/features/evaluations/components/TemplateDrawer';
import { TemplateStateChip } from '@/features/evaluations/components/TemplateStatusChip';
import {
  evaluationService as defaultEvaluationService,
  TemplateInUseError,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import {
  newDraft,
  uniqueName,
  type TemplateDraft,
} from '@/features/evaluations/templateValidation';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  GRADING_ROLE_LABEL,
  type EvaluationTemplate,
  type TemplateAssignment,
} from '@/types/evaluation';
import type { Round } from '@/types/round';

interface EvaluationTemplatePageProps {
  evaluationService?: EvaluationService;
  roundService?: RoundService;
}

type DrawerState =
  | { mode: 'create'; draft: TemplateDraft; seq: number }
  | { mode: Exclude<DrawerMode, 'create'>; templateId: string; seq: number }
  | null;

const countSubs = (t: EvaluationTemplate) =>
  t.criteria.reduce((n, c) => n + c.subCriteria.length, 0);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

// Màn Mẫu phiếu đánh giá của Giáo vụ: mục trên là danh sách đợt khóa luận kèm
// trạng thái gán phiếu cho từng vai trò chấm; mục dưới là danh sách mẫu phiếu,
// bấm vào mẫu mở panel bên phải để xem, tạo, sửa.
export const EvaluationTemplatePage: React.FC<EvaluationTemplatePageProps> = ({
  evaluationService = defaultEvaluationService,
  roundService = defaultRoundService,
}) => {
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [seq, setSeq] = useState(0);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, all, roundList] = await Promise.all([
        evaluationService.list(),
        evaluationService.listAllAssignments(),
        roundService.list(),
      ]);
      setTemplates(list);
      setAssignments(all);
      setRounds(roundList);
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
        // Nhãn trạng thái chỉ để tham khảo; lỗi tải lại không chặn thao tác.
      });
  }, [evaluationService]);

  const roundName = (id: string) =>
    rounds.find((r) => r.id === id)?.name ?? `Đợt ${id}`;
  const usageText = (t: EvaluationTemplate) =>
    t.assignments.map(
      (a) => `${roundName(a.roundId)} · ${GRADING_ROLE_LABEL[a.role]}`,
    );

  const open = (mode: Exclude<DrawerMode, 'create'>, templateId: string) => {
    setSeq((n) => n + 1);
    setDrawer({ mode, templateId, seq: seq + 1 });
  };
  const create = () => {
    setSeq((n) => n + 1);
    setDrawer({
      mode: 'create',
      draft: newDraft(
        uniqueName(
          'Mẫu phiếu mới',
          templates.map((t) => t.name),
        ),
      ),
      seq: seq + 1,
    });
  };

  const handleSaved = (saved: EvaluationTemplate, mode: 'create' | 'edit') => {
    setTemplates((list) =>
      list.some((t) => t.id === saved.id)
        ? list.map((t) => (t.id === saved.id ? saved : t))
        : [...list, saved],
    );
    setDrawer(null);
    toast.success(
      saved.status === 'Draft'
        ? 'Đã lưu mẫu phiếu ở trạng thái Nháp.'
        : mode === 'create'
          ? 'Đã tạo mẫu phiếu, đủ điều kiện sử dụng.'
          : 'Đã lưu mẫu phiếu.',
    );
  };

  const closeRemove = useCallback(() => {
    setRemoveId(null);
    setActionError(null);
  }, []);

  const removing = removeId
    ? templates.find((t) => t.id === removeId)
    : undefined;

  const confirmRemove = async (template: EvaluationTemplate) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await evaluationService.remove(template.id, {
        removeAssignments: template.assignments.length > 0,
      });
      setTemplates((list) => list.filter((t) => t.id !== template.id));
      setAssignments((list) =>
        list.filter((a) => a.templateId !== template.id),
      );
      setRemoveId(null);
      setDrawer(null);
      toast.success(
        template.assignments.length > 0
          ? 'Đã gỡ gán và xóa mẫu phiếu.'
          : 'Đã xóa mẫu phiếu.',
      );
    } catch (err: unknown) {
      // Có thể vừa được gán ở nơi khác: tải lại để hộp xác nhận nêu đúng.
      if (err instanceof TemplateInUseError) refreshTemplates();
      setActionError(
        err instanceof Error && err.message
          ? err.message
          : 'Thao tác thất bại. Thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  };

  const drawerTemplate =
    drawer && drawer.mode !== 'create'
      ? templates.find((t) => t.id === drawer.templateId)
      : undefined;

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
          <RoundAssignmentList
            rounds={rounds}
            templates={templates}
            assignments={assignments}
            evaluationService={evaluationService}
            onChange={(next) => {
              setAssignments(next);
              refreshTemplates();
            }}
          />

          <section
            className="app-card eval-section"
            aria-labelledby="eval-templates-h"
          >
            <div className="eval-section-head">
              <div>
                <h2 id="eval-templates-h">Danh sách mẫu phiếu</h2>
                <p className="app-muted eval-small">
                  Mẫu tổng điểm chưa đủ 10 lưu là Nháp. Đủ 10 điểm thì đủ điều
                  kiện sử dụng; gán cho đợt thì thành đang được sử dụng.
                </p>
              </div>
              <button
                type="button"
                className="app-button app-button-primary"
                aria-haspopup="dialog"
                onClick={create}
              >
                <Plus size={16} aria-hidden="true" />
                Tạo mẫu phiếu
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="app-muted">
                Chưa có mẫu phiếu. Chọn Tạo mẫu phiếu để bắt đầu.
              </p>
            ) : (
              <div className="app-table-scroll">
                <table className="app-table eval-template-table">
                  <thead>
                    <tr>
                      <th scope="col">Tên mẫu</th>
                      <th scope="col">Tiêu chí</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Đang gán cho</th>
                      <th scope="col">Cập nhật</th>
                      <th scope="col">
                        <span className="app-visually-hidden">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => {
                      const usage = usageText(t);
                      return (
                        <tr key={t.id}>
                          <th scope="row" className="eval-template-name">
                            <button
                              type="button"
                              className="eval-name-button"
                              aria-haspopup="dialog"
                              onClick={() => open('view', t.id)}
                            >
                              {t.name}
                            </button>
                            {t.description && (
                              <span className="app-config-hint">
                                {t.description}
                              </span>
                            )}
                          </th>
                          <td>
                            {t.criteria.length} chung · {countSubs(t)} hạng mục
                            con
                          </td>
                          <td>
                            <TemplateStateChip template={t} />
                          </td>
                          <td>
                            {usage.length === 0 ? (
                              <span className="app-muted">—</span>
                            ) : (
                              <span title={usage.join('; ')}>
                                {usage.length} vai trò
                              </span>
                            )}
                          </td>
                          <td>{formatDate(t.updatedAt ?? t.createdAt)}</td>
                          <td>
                            <div className="eval-row-actions">
                              <button
                                type="button"
                                className="app-icon-button"
                                aria-haspopup="dialog"
                                aria-label={`Xem chi tiết ${t.name}`}
                                title="Xem chi tiết"
                                onClick={() => open('view', t.id)}
                              >
                                <Eye size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="app-icon-button"
                                aria-haspopup="dialog"
                                aria-label={`Chỉnh sửa ${t.name}`}
                                title="Chỉnh sửa"
                                onClick={() => open('edit', t.id)}
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="app-icon-button eval-icon-danger"
                                aria-haspopup="dialog"
                                aria-label={`Xóa ${t.name}`}
                                title="Xóa"
                                onClick={() => setRemoveId(t.id)}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {drawer?.mode === 'create' && (
        <TemplateDrawer
          key={`new-${drawer.seq}`}
          mode="create"
          initialDraft={drawer.draft}
          otherNames={templates.map((t) => t.name)}
          usage={[]}
          evaluationService={evaluationService}
          escapeDisabled={removeId !== null}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
          onRemove={() => undefined}
        />
      )}
      {drawer && drawer.mode !== 'create' && drawerTemplate && (
        <TemplateDrawer
          key={`${drawerTemplate.id}-${drawer.seq}`}
          mode={drawer.mode}
          template={drawerTemplate}
          otherNames={templates
            .filter((t) => t.id !== drawerTemplate.id)
            .map((t) => t.name)}
          usage={usageText(drawerTemplate)}
          evaluationService={evaluationService}
          escapeDisabled={removeId !== null}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
          onRemove={() => setRemoveId(drawerTemplate.id)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Xóa ${removing.name}?`}
          description={
            removing.assignments.length > 0
              ? `Mẫu đang được sử dụng cho ${usageText(removing).join('; ')}. Nếu xóa, các vai trò này sẽ chưa có mẫu phiếu và cần gán mẫu khác trước khi chấm. Thao tác này không hoàn tác được.`
              : 'Mẫu chưa gán cho vai trò nào. Thao tác này không hoàn tác được.'
          }
          cancelLabel="Hủy"
          confirmLabel={
            removing.assignments.length > 0 ? 'Gỡ gán và xóa' : 'Xóa mẫu phiếu'
          }
          danger
          busy={busy}
          error={actionError}
          onCancel={closeRemove}
          onConfirm={() => void confirmRemove(removing)}
        />
      )}
    </>
  );
};
