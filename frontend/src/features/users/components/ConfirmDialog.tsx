'use client';

import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  // Nút an toàn nằm bên trái ("Hủy" / "Giữ ..."), nút hành động bên phải.
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Hộp thoại xác nhận theo docs/DESIGN/02: nút an toàn bên trái, nút nguy hiểm
// bên phải với nhãn nêu rõ hành động. Tiêu điểm đầu tiên ở nút an toàn.
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  description,
  cancelLabel,
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onCancel,
  onConfirm,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="dialog"
      >
        <div className="login-form">
          <div className="login-heading">
            <h2 id="confirm-dialog-title">{title}</h2>
            <p id="confirm-dialog-description">{description}</p>
          </div>
          {error && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="dialog-actions dialog-actions-split">
            <button
              ref={cancelRef}
              type="button"
              className="app-button"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={
                danger
                  ? 'app-button app-button-danger'
                  : 'app-button app-button-primary'
              }
              onClick={onConfirm}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? 'Đang xử lý...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
