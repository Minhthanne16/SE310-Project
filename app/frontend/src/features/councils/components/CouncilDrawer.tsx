'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import {
  CouncilDetail,
  statusChipClass,
} from '@/features/councils/components/CouncilDetail';
import { CouncilEditor } from '@/features/councils/components/CouncilEditor';
import type { Council, CouncilBoard, CouncilPoolTopic } from '@/types/council';
import type { CouncilDraft } from '@/features/councils/councilDraft';

interface CouncilDrawerProps {
  council: Council | null;
  draft: CouncilDraft | null;
  board: CouncilBoard;
  pool: CouncilPoolTopic[];
  problems: string[] | null;
  checking: boolean;
  busy: boolean;
  submitted: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChangeDraft: (draft: CouncilDraft) => void;
  onSaveDraft: () => void;
  onDelete: () => void;
  onCancelSchedule: () => void;
  onCorrect: () => void;
}

export const CouncilDrawer: React.FC<CouncilDrawerProps> = ({
  council,
  draft,
  board,
  pool,
  problems,
  checking,
  busy,
  submitted,
  readOnly = false,
  onClose,
  onEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveDraft,
  onDelete,
  onCancelSchedule,
  onCorrect,
}) => {
  const isEditing = draft !== null;
  const drawerRef = useDialogFocus<HTMLElement>();
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = isEditing
    ? draft.id
      ? `Sửa ${council?.name ?? draft.name}`
      : 'Tạo hội đồng'
    : council?.name ?? 'Chi tiết hội đồng';

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
        aria-labelledby="council-drawer-title"
        className="app-drawer cnc-drawer"
      >
        <header className="app-drawer-header">
          <div className="eval-drawer-title">
            <h2 id="council-drawer-title">{title}</h2>
            {council && !isEditing && (
              <span className={statusChipClass(council.status)}>
                {council.status}
              </span>
            )}
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
          {isEditing ? (
            <CouncilEditor
              draft={draft}
              board={board}
              pool={pool}
              problems={problems}
              checking={checking}
              busy={busy}
              submitted={submitted}
              onChange={onChangeDraft}
              onCancel={onCancelEdit}
              onSave={onSaveDraft}
            />
          ) : council ? (
            <CouncilDetail
              council={council}
              busy={busy}
              readOnly={readOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onCancelSchedule={onCancelSchedule}
              onCorrect={onCorrect}
            />
          ) : (
            <p className="app-muted">Không có thông tin hội đồng.</p>
          )}
        </div>
      </aside>
    </div>
  );
};
