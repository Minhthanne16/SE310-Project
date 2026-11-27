'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialogFocus } from '@/lib/useDialogFocus';
import {
  GRADING_ROLE_LABEL,
  GRADING_ROLES,
  type EvaluationTemplate,
  type GradingRole,
  type TemplateAssignment,
} from '@/types/evaluation';
import { TemplateDrawer } from '@/features/evaluations/components/TemplateDrawer';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import {
  formatScore,
  newDraft,
  toHundredths,
  uniqueName,
} from '@/features/evaluations/templateValidation';
import type { Round } from '@/types/round';

const templateTotal = (t: EvaluationTemplate) =>
  (t.criteria ?? []).reduce(
    (sum, c) => sum + (toHundredths(String(c.maxScore)) ?? 0),
    0,
  );

const ROLE_DESC: Record<GradingRole, string> = {
  Supervisor: 'Phiếu chấm dành cho Giảng viên hướng dẫn',
  Reviewer: 'Phiếu chấm dành cho Giảng viên phản biện',
  Committee: 'Phiếu chấm dùng chung cho Chủ tịch và Thư ký hội đồng',
};

interface TemplateAssignmentSectionProps {
  round: Round;
  evaluationService: EvaluationService;
}

export const TemplateAssignmentSection: React.FC<
  TemplateAssignmentSectionProps
> = ({ round, evaluationService }) => {
  const isDraft = round.status === 'Nháp';
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<GradingRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [tplList, assignList] = await Promise.all([
          evaluationService.list(),
          evaluationService.listAssignments(round.id),
        ]);
        if (!cancelled) {
          setTemplates(tplList);
          setAssignments(
            assignList.filter(
              (a: TemplateAssignment) => a.roundId === round.id,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          toast.error('Không tải được danh sách mẫu phiếu đánh giá.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [evaluationService, round.id]);

  const getAssignment = (role: GradingRole) =>
    assignments.find((a) => a.role === role);

  return (
    <div className="rnd-templates-section" aria-label="Mẫu phiếu đánh giá">
      {!isDraft && (
        <div role="note" className="rnd-note rnd-note-info">
          Đợt đã mở, không sửa gán mẫu phiếu đánh giá.
        </div>
      )}

      {loading ? (
        <p className="app-muted">Đang tải danh sách mẫu phiếu...</p>
      ) : (
        <div className="app-card rnd-assign-table-box">
          <table className="app-table rnd-assign-table">
            <thead>
              <tr>
                <th scope="col" className="rnd-col-min-180">
                  Vai trò
                </th>
                <th scope="col" className="rnd-col-min-220">
                  Mẫu phiếu đánh giá
                </th>
                <th scope="col">Thang điểm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {GRADING_ROLES.map((role) => {
                const a = getAssignment(role);
                const assignedTemplate = a
                  ? templates.find((t) => t.id === a.templateId)
                  : null;

                return (
                  <tr
                    key={role}
                    className="rnd-clickable-row"
                    onClick={() => setSelectedRole(role)}
                  >
                    <td>
                      <b>{GRADING_ROLE_LABEL[role]}</b>
                      <span className="rnd-meta">{ROLE_DESC[role]}</span>
                    </td>
                    <td>
                      {a ? (
                        <span className="rnd-assigned-title">
                          {a.templateName ||
                            assignedTemplate?.name ||
                            'Mẫu phiếu'}
                        </span>
                      ) : (
                        <span className="app-chip app-chip-pending">
                          Chưa gán
                        </span>
                      )}
                    </td>
                    <td>Thang 10</td>
                    <td>
                      <span
                        className={`app-chip ${a ? 'app-chip-success' : 'app-chip-pending'}`}
                      >
                        {a ? 'Đã gán' : 'Chưa gán'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="app-button app-button-small"
                        aria-haspopup="dialog"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRole(role);
                        }}
                      >
                        {a ? 'Đổi mẫu' : 'Gán mẫu'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedRole && (
        <RoleAssignmentDrawer
          role={selectedRole}
          round={round}
          isDraft={isDraft}
          templates={templates.filter((t) => t.status === 'Active')}
          allTemplates={templates}
          onTemplateCreated={(t) => setTemplates((prev) => [...prev, t])}
          currentAssignment={getAssignment(selectedRole)}
          evaluationService={evaluationService}
          onClose={() => setSelectedRole(null)}
          onChanged={(saved) => {
            if (saved) {
              setAssignments((prev) => [
                ...prev.filter((a) => a.role !== selectedRole),
                saved,
              ]);
            } else {
              setAssignments((prev) =>
                prev.filter((a) => a.role !== selectedRole),
              );
            }
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
};

interface RoleAssignmentDrawerProps {
  role: GradingRole;
  round: Round;
  isDraft: boolean;
  // Mẫu đủ điều kiện sử dụng (chọn được).
  templates: EvaluationTemplate[];
  // Mọi mẫu trong thư viện, để xem chi tiết mẫu đang gán và kiểm tra trùng tên.
  allTemplates: EvaluationTemplate[];
  onTemplateCreated: (template: EvaluationTemplate) => void;
  currentAssignment?: TemplateAssignment;
  evaluationService: EvaluationService;
  onClose: () => void;
  onChanged: (assignment: TemplateAssignment | null) => void;
}

const RoleAssignmentDrawer: React.FC<RoleAssignmentDrawerProps> = ({
  role,
  round,
  isDraft,
  templates,
  allTemplates,
  onTemplateCreated,
  currentAssignment,
  evaluationService,
  onClose,
  onChanged,
}) => {
  const [selectedId, setSelectedId] = useState(
    currentAssignment?.templateId ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Đang tạo mẫu mới ngay trong panel (trình sửa mẫu nhúng bên dưới).
  const [creating, setCreating] = useState(false);
  const drawerRef = useDialogFocus<HTMLElement>();
  const selected = allTemplates.find((t) => t.id === selectedId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Khi tạo mẫu, trình sửa tự xử lý Escape (hỏi bỏ thay đổi chưa lưu).
      if (e.key === 'Escape' && !busy && !creating) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy, creating]);

  const handleCreated = (saved: EvaluationTemplate) => {
    onTemplateCreated(saved);
    setCreating(false);
    if (saved.status === 'Active' && isDraft) {
      setSelectedId(saved.id);
      toast.success(
        `Đã lưu mẫu «${saved.name}» vào thư viện và chọn cho ${GRADING_ROLE_LABEL[role]}. Bấm Lưu để gán cho đợt.`,
      );
    } else if (saved.status === 'Active') {
      toast.success(
        `Đã lưu mẫu «${saved.name}» vào thư viện. Đợt đã mở nên mẫu chưa đổi; dùng cho đợt khác.`,
      );
    } else {
      toast.success(
        `Đã lưu mẫu «${saved.name}» (Nháp) vào thư viện. Hoàn thiện ở trang Phiếu đánh giá để gán được.`,
      );
    }
  };

  const handleSave = async () => {
    if (busy || !isDraft) return;
    if (!selectedId) {
      if (currentAssignment) {
        handleUnassign();
      }
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await evaluationService.assign(round.id, role, selectedId);
      toast.success(`Đã gán mẫu cho ${GRADING_ROLE_LABEL[role]}.`);
      onChanged(saved);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Không thể gán mẫu phiếu.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async () => {
    if (busy || !isDraft) return;
    setBusy(true);
    setError(null);
    try {
      await evaluationService.unassign(round.id, role);
      toast.success(`Đã gỡ mẫu phiếu của ${GRADING_ROLE_LABEL[role]}.`);
      onChanged(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Không thể gỡ mẫu phiếu.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="app-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-drawer-title"
        className="app-drawer eval-drawer"
      >
        {creating ? (
          <TemplateDrawer
            embedded
            mode="create"
            initialDraft={newDraft(
              uniqueName(
                'Mẫu phiếu mới',
                allTemplates.map((t) => t.name),
              ),
            )}
            otherNames={allTemplates.map((t) => t.name)}
            usage={[]}
            evaluationService={evaluationService}
            onClose={() => setCreating(false)}
            onSaved={handleCreated}
            onRemove={() => {}}
          />
        ) : (
          <>
            <header className="app-drawer-header">
              <div className="eval-drawer-title">
                <h2 id="role-drawer-title">
                  Gán mẫu: {GRADING_ROLE_LABEL[role]}
                </h2>
                <span className="app-muted eval-small">{round.name}</span>
              </div>
              <button
                type="button"
                className="app-icon-button"
                aria-label="Đóng"
                onClick={onClose}
                disabled={busy}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="app-drawer-body">
              <p className="app-muted eval-small">{ROLE_DESC[role]}</p>

              <div className="eval-field rnd-mt-4">
                <label htmlFor="select-template">
                  Chọn mẫu phiếu đã ban hành
                </label>
                <select
                  id="select-template"
                  className="app-select"
                  value={selectedId}
                  disabled={busy || !isDraft}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">— Chưa gán mẫu —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {!isDraft && (
                <p role="note" className="rnd-note rnd-note-info">
                  Đợt đã mở nên mẫu áp dụng đã khóa, chỉ xem. Bạn vẫn tạo được
                  mẫu mới để dùng cho đợt khác.
                </p>
              )}

              <section className="rnd-tpl-detail" aria-label="Chi tiết mẫu">
                <div className="rnd-tpl-detail-head">
                  <h3>Chi tiết mẫu</h3>
                  {selected && (
                    <span className="app-chip">
                      Tổng {formatScore(templateTotal(selected))} / 10
                    </span>
                  )}
                </div>
                {selected ? (
                  <>
                    <p className="app-muted eval-small">
                      {selected.description || 'Không có mô tả.'}
                    </p>
                    <ol className="rnd-tpl-criteria">
                      {(selected.criteria ?? []).map((c) => (
                        <li key={c.id}>
                          <span className="rnd-tpl-criterion">
                            <span>{c.name}</span>
                            <span>
                              {formatScore(
                                toHundredths(String(c.maxScore)) ?? 0,
                              )}{' '}
                              điểm
                            </span>
                          </span>
                          {c.subCriteria.length > 0 && (
                            <ul className="rnd-tpl-subs">
                              {c.subCriteria.map((sc) => (
                                <li key={sc.id}>
                                  <span>{sc.name}</span>
                                  <span>
                                    {formatScore(
                                      toHundredths(String(sc.maxScore)) ?? 0,
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="rnd-tpl-empty">
                    Chưa gán mẫu phiếu cho vai trò này. Chọn một mẫu ở trên hoặc
                    tạo mẫu mới.
                  </p>
                )}
              </section>

              <div>
                <button
                  type="button"
                  className="app-button"
                  disabled={busy}
                  onClick={() => setCreating(true)}
                >
                  + Tạo mẫu phiếu mới
                </button>
                <p className="app-muted eval-small rnd-mt-2">
                  Mẫu mới lưu vào thư viện mẫu phiếu và chọn lại được cho mọi
                  đợt khác.
                </p>
              </div>

              {error && (
                <p role="alert" className="eval-field-error">
                  {error}
                </p>
              )}

              {allTemplates.length === 0 && (
                <p className="app-muted eval-small">
                  Chưa có mẫu phiếu nào trong thư viện. Tạo mẫu mới ở trên.
                </p>
              )}
            </div>

            <footer className="app-drawer-footer">
              {currentAssignment && isDraft && (
                <button
                  type="button"
                  className="app-button eval-delete"
                  disabled={busy}
                  onClick={() => void handleUnassign()}
                >
                  Gỡ mẫu
                </button>
              )}
              <span className="rnd-spacer-flex" />
              <button
                type="button"
                className="app-button"
                disabled={busy}
                onClick={onClose}
              >
                Hủy
              </button>
              {isDraft && (
                <button
                  type="button"
                  className="app-button app-button-primary"
                  disabled={busy || (!selectedId && !currentAssignment)}
                  onClick={() => void handleSave()}
                >
                  {busy ? 'Đang lưu...' : 'Lưu'}
                </button>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
};
