'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RoundStatusChip } from '@/features/rounds/components/RoundChips';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import { useDialogFocus } from '@/lib/useDialogFocus';
import {
  GRADING_ROLE_LABEL,
  GRADING_ROLES,
  type EvaluationTemplate,
  type GradingRole,
  type TemplateAssignment,
} from '@/types/evaluation';
import type { Round } from '@/types/round';

const ROLE_WHO: Record<GradingRole, string> = {
  Supervisor: 'Chấm CBHD · hệ số 2',
  Reviewer: 'Chấm CBPB · hệ số 2',
  Committee: 'Chủ tịch và thư ký dùng chung mẫu · thư ký nhập',
};

interface RoundAssignmentListProps {
  rounds: Round[];
  templates: EvaluationTemplate[];
  assignments: TemplateAssignment[];
  evaluationService: EvaluationService;
  // Gán hoặc gỡ xong: cập nhật danh sách gán và số vai trò dùng mẫu.
  onChange: (next: TemplateAssignment[]) => void;
}

// Mục trên của trang: mỗi đợt một hàng, cho thấy ba vai trò chấm đã gán mẫu nào.
export const RoundAssignmentList: React.FC<RoundAssignmentListProps> = ({
  rounds: allRounds,
  templates,
  assignments,
  evaluationService,
  onChange,
}) => {
  // Đợt đã kết thúc không hiện; đợt nháp và đang diễn ra thì hiện và gán được.
  const rounds = allRounds.filter((r) => r.status !== 'Đã kết thúc');
  const [openId, setOpenId] = useState<string | null>(null);
  const openRound = rounds.find((r) => r.id === openId) ?? null;

  const cell = (round: Round, role: GradingRole) => {
    const a = assignments.find(
      (x) => x.roundId === round.id && x.role === role,
    );
    return a ? (
      <span className="eval-assigned-name">{a.templateName}</span>
    ) : (
      <span className="app-chip app-chip-pending">Chưa gán</span>
    );
  };

  return (
    <section className="app-card eval-section" aria-labelledby="eval-rounds-h">
      <div className="eval-section-head">
        <div>
          <h2 id="eval-rounds-h">Gán mẫu theo đợt khóa luận</h2>
          <p className="app-muted eval-small">
            Mỗi đợt dùng một mẫu cho giảng viên hướng dẫn, giảng viên phản biện
            và hội đồng. Đổi mẫu chỉ được khi chưa có giảng viên nào nhập điểm
            theo mẫu đang gán.
          </p>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="app-muted">
          Chưa có đợt nào để gán. Tạo hoặc mở đợt ở mục Đợt khóa luận rồi quay
          lại gán mẫu phiếu.
        </p>
      ) : (
        <div className="app-table-scroll">
          <table className="app-table eval-round-table">
            <thead>
              <tr>
                <th scope="col">Đợt</th>
                {GRADING_ROLES.map((role) => (
                  <th key={role} scope="col">
                    {GRADING_ROLE_LABEL[role]}
                  </th>
                ))}
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => {
                const assigned = GRADING_ROLES.filter((role) =>
                  assignments.some(
                    (a) => a.roundId === round.id && a.role === role,
                  ),
                ).length;
                return (
                  <tr key={round.id}>
                    <th scope="row" className="eval-round-name">
                      <span>{round.name}</span>
                      <span className="eval-round-meta">
                        <RoundStatusChip status={round.status} />
                        <span className="app-muted eval-small">
                          {assigned}/{GRADING_ROLES.length} vai trò đã gán
                        </span>
                      </span>
                    </th>
                    {GRADING_ROLES.map((role) => (
                      <td key={role}>{cell(round, role)}</td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="app-button app-button-small"
                        aria-haspopup="dialog"
                        aria-label={`Gán mẫu ${round.name}`}
                        onClick={() => setOpenId(round.id)}
                      >
                        Gán mẫu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openRound && (
        <AssignmentDrawer
          round={openRound}
          templates={templates}
          assignments={assignments.filter((a) => a.roundId === openRound.id)}
          evaluationService={evaluationService}
          onChange={(roundAssignments) =>
            onChange([
              ...assignments.filter((a) => a.roundId !== openRound.id),
              ...roundAssignments,
            ])
          }
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
};

interface AssignmentDrawerProps {
  round: Round;
  templates: EvaluationTemplate[];
  assignments: TemplateAssignment[];
  evaluationService: EvaluationService;
  onChange: (next: TemplateAssignment[]) => void;
  onClose: () => void;
}

// Panel bên phải: chọn mẫu cho từng vai trò chấm của một đợt, chọn là gán ngay.
const AssignmentDrawer: React.FC<AssignmentDrawerProps> = ({
  round,
  templates,
  assignments,
  evaluationService,
  onChange,
  onClose,
}) => {
  const [busyRole, setBusyRole] = useState<GradingRole | null>(null);
  const [roleError, setRoleError] = useState<{
    role: GradingRole;
    message: string;
  } | null>(null);
  const drawerRef = useDialogFocus<HTMLElement>();
  const busyRef = useRef<GradingRole | null>(null);
  busyRef.current = busyRole;
  // Chỉ mẫu đủ điều kiện (không phải Nháp) gán được.
  const eligible = templates.filter((t) => t.status === 'Active');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = async (role: GradingRole, templateId: string) => {
    if (busyRole) return;
    setBusyRole(role);
    setRoleError(null);
    try {
      if (templateId) {
        const saved = await evaluationService.assign(
          round.id,
          role,
          templateId,
        );
        onChange([...assignments.filter((a) => a.role !== role), saved]);
      } else {
        await evaluationService.unassign(round.id, role);
        onChange(assignments.filter((a) => a.role !== role));
      }
    } catch (err: unknown) {
      setRoleError({
        role,
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Thao tác thất bại. Thử lại sau.',
      });
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <div
      className="app-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyRole) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-drawer-title"
        className="app-drawer"
      >
        <header className="app-drawer-header">
          <div className="eval-drawer-title">
            <h2 id="assign-drawer-title">Gán mẫu cho đợt</h2>
            <RoundStatusChip status={round.status} />
          </div>
          <button
            type="button"
            className="app-icon-button"
            aria-label="Đóng"
            onClick={onClose}
            disabled={!!busyRole}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="app-drawer-body">
          <p className="eval-assign-round">{round.name}</p>
          {GRADING_ROLES.map((role) => {
            const current = assignments.find((a) => a.role === role);
            const currentTemplate = templates.find(
              (t) => t.id === current?.templateId,
            );
            const options =
              currentTemplate && currentTemplate.status !== 'Active'
                ? [currentTemplate, ...eligible]
                : eligible;
            const id = `gan-${role}`;
            return (
              <div key={role} className="eval-assign-card">
                <label htmlFor={id}>{GRADING_ROLE_LABEL[role]}</label>
                <span className="app-muted eval-small">{ROLE_WHO[role]}</span>
                <select
                  id={id}
                  className="app-select"
                  value={current?.templateId ?? ''}
                  disabled={busyRole === role}
                  aria-describedby={
                    roleError?.role === role ? `${id}-error` : undefined
                  }
                  onChange={(e) => void choose(role, e.target.value)}
                >
                  <option value="">— Chưa chọn mẫu —</option>
                  {options.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={t.status !== 'Active'}
                    >
                      {t.name}
                    </option>
                  ))}
                </select>
                {roleError?.role === role && (
                  <span
                    id={`${id}-error`}
                    role="alert"
                    className="eval-field-error"
                  >
                    {roleError.message}
                  </span>
                )}
              </div>
            );
          })}
          {eligible.length === 0 && (
            <p className="app-muted eval-small">
              Chưa có mẫu đủ điều kiện sử dụng. Tạo mẫu có tổng điểm các tiêu
              chí chung bằng 10 để gán được.
            </p>
          )}
        </div>

        <footer className="app-drawer-footer">
          <button
            type="button"
            className="app-button app-button-primary"
            onClick={onClose}
            disabled={!!busyRole}
          >
            Xong
          </button>
        </footer>
      </aside>
    </div>
  );
};
