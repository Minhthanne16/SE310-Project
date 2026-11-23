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
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import type { Round } from '@/types/round';

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
  templates: EvaluationTemplate[];
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
  const drawerRef = useDialogFocus<HTMLElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

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
        className="app-drawer"
      >
        <header className="app-drawer-header">
          <div className="eval-drawer-title">
            <h2 id="role-drawer-title">Gán mẫu: {GRADING_ROLE_LABEL[role]}</h2>
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
            <label htmlFor="select-template">Chọn mẫu phiếu đã ban hành</label>
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

          {error && (
            <p role="alert" className="eval-field-error">
              {error}
            </p>
          )}

          {templates.length === 0 && (
            <p className="app-muted eval-small">
              Chưa có mẫu phiếu nào ở trạng thái Đủ điều kiện sử dụng (Active).
              Vui lòng ban hành mẫu phiếu ở trang Phiếu đánh giá trước.
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
      </aside>
    </div>
  );
};
