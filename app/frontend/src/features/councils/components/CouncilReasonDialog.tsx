'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface CouncilReasonDialogProps {
  title: string;
  description: string;
  // Đính chính có thêm ô nội dung; hủy lịch chỉ có lý do.
  withContent?: boolean;
  contentLabel?: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (values: { content: string; reason: string }) => void;
}

const MAX_REASON = 800;
const MAX_CONTENT = 2000;

// Hộp thoại có lý do bắt buộc cho Hủy lịch (PDR-019) và Đính chính (PDR-018). Lỗi thiếu trường hiện tại chỗ.
export const CouncilReasonDialog: React.FC<CouncilReasonDialogProps> = ({
  title,
  description,
  withContent = false,
  contentLabel = 'Nội dung đính chính',
  cancelLabel,
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onCancel,
  onConfirm,
}) => {
  const firstRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>({
    initialFocusRef: firstRef,
  });
  const [content, setContent] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
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

  const contentError =
    withContent && submitted && !content.trim()
      ? 'Nhập nội dung đính chính.'
      : null;
  const reasonError = submitted && !reason.trim() ? 'Nhập lý do.' : null;

  const submit = () => {
    setSubmitted(true);
    if ((withContent && !content.trim()) || !reason.trim()) return;
    onConfirm({ content: content.trim(), reason: reason.trim() });
  };

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cnc-reason-title"
        aria-describedby="cnc-reason-description"
        className="dialog dialog-medium"
      >
        <div className="cnc-dialog">
          <div className="cnc-dialog-heading">
            <h2 id="cnc-reason-title">{title}</h2>
            <p id="cnc-reason-description">{description}</p>
          </div>
          {withContent && (
            <div className="tpc-form-field">
              <label htmlFor="cnc-reason-content">{contentLabel}</label>
              <textarea
                id="cnc-reason-content"
                ref={firstRef}
                rows={3}
                maxLength={MAX_CONTENT}
                value={content}
                disabled={busy}
                aria-invalid={contentError ? true : undefined}
                aria-describedby={
                  contentError ? 'cnc-reason-content-error' : undefined
                }
                onChange={(e) => setContent(e.target.value)}
              />
              {contentError && (
                <p
                  id="cnc-reason-content-error"
                  role="alert"
                  className="tpc-form-error"
                >
                  {contentError}
                </p>
              )}
            </div>
          )}
          <div className="tpc-form-field">
            <label htmlFor="cnc-reason-text">Lý do</label>
            <textarea
              id="cnc-reason-text"
              ref={withContent ? undefined : firstRef}
              rows={3}
              maxLength={MAX_REASON}
              value={reason}
              disabled={busy}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={
                reasonError ? 'cnc-reason-text-error' : undefined
              }
              onChange={(e) => setReason(e.target.value)}
            />
            {reasonError && (
              <p
                id="cnc-reason-text-error"
                role="alert"
                className="tpc-form-error"
              >
                {reasonError}
              </p>
            )}
          </div>
          {error && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="dialog-actions dialog-actions-split">
            <button
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
              onClick={submit}
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
