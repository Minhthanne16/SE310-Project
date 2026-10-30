'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import {
  GRADING_ROLE_LABEL,
  GRADING_ROLES,
  TEMPLATE_STATUS_LABEL,
  type EvaluationTemplate,
  type GradingRole,
  type TemplateAssignment,
} from '@/types/evaluation';
import type { Round } from '@/types/round';

interface AssignmentSectionProps {
  rounds: Round[];
  round: Round | null;
  templates: EvaluationTemplate[];
  evaluationService: EvaluationService;
  onSelectRound: (roundId: string) => void;
  // Gán/gỡ làm đổi nhãn "Đang gán" của danh sách mẫu.
  onChanged: () => void;
}

const ROLE_WHO: Record<GradingRole, string> = {
  Supervisor: 'Chấm CBHD · hệ số 2',
  Reviewer: 'Chấm CBPB · hệ số 2',
  Committee: 'Chủ tịch và thư ký dùng chung mẫu · thư ký nhập',
};

// Khối "Gán mẫu phiếu cho đợt" theo design: ba thẻ vai trò, chọn mẫu là gán ngay.
export const AssignmentSection: React.FC<AssignmentSectionProps> = ({
  rounds,
  round,
  templates,
  evaluationService,
  onSelectRound,
  onChanged,
}) => {
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<GradingRole | null>(null);
  const [roleError, setRoleError] = useState<{
    role: GradingRole;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!round) return;
    setLoading(true);
    setLoadError(null);
    setRoleError(null);
    try {
      setAssignments(await evaluationService.listAssignments(round.id));
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Không tải được mẫu đã gán.',
      );
    } finally {
      setLoading(false);
    }
  }, [evaluationService, round]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = round?.status === 'Đã kết thúc';
  const active = templates.filter((t) => t.status === 'Active');

  const choose = async (role: GradingRole, templateId: string) => {
    if (!round || busyRole) return;
    setBusyRole(role);
    setRoleError(null);
    try {
      if (templateId) {
        const saved = await evaluationService.assign(
          round.id,
          role,
          templateId,
        );
        setAssignments((list) => [
          ...list.filter((a) => a.role !== role),
          saved,
        ]);
      } else {
        await evaluationService.unassign(round.id, role);
        setAssignments((list) => list.filter((a) => a.role !== role));
      }
      onChanged();
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
    <section className="app-card eval-assign" aria-labelledby="gan-h">
      <div className="eval-assign-head">
        <div className="eval-assign-title">
          <h2 id="gan-h">Gán mẫu phiếu cho đợt</h2>
          {rounds.length > 0 ? (
            <select
              className="app-select eval-round-select"
              aria-label="Đợt"
              value={round?.id ?? ''}
              onChange={(e) => onSelectRound(e.target.value)}
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="app-muted">Chưa có đợt</span>
          )}
        </div>
        <span className="app-muted eval-small">
          {readOnly
            ? 'Đợt đã kết thúc nên chỉ xem.'
            : 'Đổi mẫu chỉ được khi chưa có giảng viên nào nhập điểm theo mẫu đang gán.'}
        </span>
      </div>

      {!round ? (
        <p className="app-muted">
          Tạo đợt ở mục Đợt khóa luận rồi quay lại gán mẫu phiếu.
        </p>
      ) : loadError ? (
        <div role="alert" className="eval-summary">
          {loadError}{' '}
          <button
            type="button"
            className="eval-link-button"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className="eval-assign-grid" aria-busy={loading}>
          {GRADING_ROLES.map((role) => {
            const current = assignments.find((a) => a.role === role);
            const currentTemplate = templates.find(
              (t) => t.id === current?.templateId,
            );
            const options =
              currentTemplate && currentTemplate.status !== 'Active'
                ? [currentTemplate, ...active]
                : active;
            const id = `gan-${role}`;
            return (
              <div key={role} className="eval-assign-card">
                <label htmlFor={id}>{GRADING_ROLE_LABEL[role]}</label>
                <span className="app-muted eval-small">{ROLE_WHO[role]}</span>
                <select
                  id={id}
                  className="app-select"
                  value={current?.templateId ?? ''}
                  disabled={readOnly || loading || busyRole === role}
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
                      {t.status === 'Active'
                        ? t.name
                        : `${t.name} (${TEMPLATE_STATUS_LABEL[t.status].toLowerCase()})`}
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
        </div>
      )}
      {round && active.length === 0 && (
        <span className="app-muted eval-small">
          Chỉ mẫu đang dùng mới gán được. Lưu mẫu rồi chọn “Chuyển sang đang
          dùng”.
        </span>
      )}
    </section>
  );
};
