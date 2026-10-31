'use client';

import React, { useEffect, useRef } from 'react';
import '@/features/rounds/rounds.css';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface RoundModalProps {
  // dialog: hộp thông tin/biểu mẫu; alertdialog: xác nhận hành động nguy hiểm.
  role?: 'dialog' | 'alertdialog';
  titleId: string;
  size?: 'sm' | 'md' | 'lg' | 'wide';
  // Không đóng được bằng Escape khi đang xử lý.
  busy?: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

const SIZE_CLASS = {
  sm: '',
  md: 'rnd-modal-md',
  lg: 'rnd-modal-lg',
  wide: 'rnd-modal-wide',
} as const;

// Hộp thoại theo artboard Đợt khóa luận: nền mờ, hộp trắng bo 16px.
export const RoundModal: React.FC<RoundModalProps> = ({
  role = 'dialog',
  titleId,
  size = 'sm',
  busy = false,
  onClose,
  initialFocusRef,
  children,
}) => {
  const dialogRef = useDialogFocus<HTMLDivElement>({ initialFocusRef });
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={
        size === 'wide' ? 'rnd-backdrop rnd-backdrop-top' : 'rnd-backdrop'
      }
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`rnd-modal ${SIZE_CLASS[size]}`}
      >
        {children}
      </div>
    </div>
  );
};
