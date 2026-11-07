'use client';

import React, { useState } from 'react';
import { History } from 'lucide-react';
import type { UserService } from '@/features/users/services/userService';
import {
  describeAuditActor,
  describeAuditEntry,
} from '@/features/users/userAudit';
import type { UserAuditEntry } from '@/types/user';

interface UserAuditHistoryProps {
  userId: string;
  userService: UserService;
}

type State =
  | { kind: 'idle' | 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; entries: UserAuditEntry[] };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Lịch sử thao tác trên tài khoản (PDR-036, PDR-052). Thu gọn mặc định và chỉ
// tải khi mở lần đầu để ngăn Sửa không phải chờ thêm một request.
export const UserAuditHistory: React.FC<UserAuditHistoryProps> = ({
  userId,
  userService,
}) => {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'loaded', entries: await userService.getAudit(userId) });
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Không tải được lịch sử.',
      });
    }
  };

  return (
    <details
      className="usr-history"
      onToggle={(e) => {
        if (e.currentTarget.open && state.kind === 'idle') void load();
      }}
    >
      <summary>
        <History size={16} aria-hidden="true" />
        Lịch sử thao tác
      </summary>
      {state.kind === 'loading' && (
        <p role="status" className="usr-history-status">
          Đang tải lịch sử...
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="usr-history-status">
          <span>{state.message}</span>{' '}
          <button
            type="button"
            className="usr-link-btn"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}
      {state.kind === 'loaded' && state.entries.length === 0 && (
        <p className="usr-history-status">Chưa có thao tác nào được ghi.</p>
      )}
      {state.kind === 'loaded' && state.entries.length > 0 && (
        <ol className="usr-history-list">
          {state.entries.map((entry) => {
            const { title, changes } = describeAuditEntry(entry);
            return (
              <li key={entry.id}>
                <div className="usr-history-head">
                  <strong>{title}</strong>
                  <time dateTime={entry.createdAt}>
                    {formatTime(entry.createdAt)}
                  </time>
                </div>
                <span className="usr-history-actor">
                  Bởi {describeAuditActor(entry, userId)}
                </span>
                {changes.length > 0 && (
                  <ul>
                    {changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
};
