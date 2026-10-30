'use client';

import React, { useEffect, useRef } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface UserConfirmDialogProps {
  title: string;
  // Dòng nêu tài khoản: "Họ tên · Mã · Vai trò".
  who: string;
  description: string;
  // Danh sách dữ liệu liên quan (khung cam), bỏ trống thì không hiện.
  items?: string[];
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Hộp thoại xác nhận của màn Người dùng (xóa, vô hiệu hóa, kích hoạt lại):
// role="alertdialog", nút an toàn bên trái, nút hành động bên phải.
export const UserConfirmDialog: React.FC<UserConfirmDialogProps> = ({
  title,
  who,
  description,
  items,
  cancelLabel = 'Hủy',
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onCancel,
  onConfirm,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>({
    initialFocusRef: cancelRef,
  });
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="usr-overlay usr-overlay-center usr-overlay-top">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="usr-confirm-title"
        aria-describedby="usr-confirm-desc"
        className="usr-modal usr-modal-sm"
      >
        <h2 id="usr-confirm-title" className="usr-h2-sm">
          {title}
        </h2>
        <span className="usr-who">{who}</span>
        <p id="usr-confirm-desc" className="usr-text">
          {description}
        </p>
        {items && items.length > 0 && (
          <ul className="usr-data-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {error && (
          <div role="alert" className="usr-alert">
            {error}
          </div>
        )}
        <div className="usr-actions">
          <button
            ref={cancelRef}
            type="button"
            className="usr-btn"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`usr-btn ${danger ? 'usr-btn-danger-solid' : 'usr-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
