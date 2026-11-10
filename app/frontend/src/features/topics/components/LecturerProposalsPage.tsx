'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/features/topics/topics.css';
import { formatDateTime } from '@/features/rounds/roundUtils';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  lecturerProposalService as defaultService,
  type LecturerProposalService,
} from '@/features/topics/services/topicApiService';
import { useDialogFocus } from '@/lib/useDialogFocus';
import type { Round } from '@/types/round';
import type { LecturerProposals, TopicDetailDto } from '@/types/topic';

interface LecturerProposalsPageProps {
  service?: LecturerProposalService;
}
type Tab = 'pending' | 'processed';
type Dialog = { kind: 'accept' | 'reject'; proposal: TopicDetailDto } | null;

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const History: React.FC<{ proposal: TopicDetailDto }> = ({ proposal }) => (
  <details>
    <summary>Lịch sử ({proposal.history.length})</summary>
    <ul className="tpc-history">
      {proposal.history.map((entry) => (
        <li key={entry.id}>
          <span>{formatDateTime(entry.at)}</span>
          <span>{entry.actor}</span>
          <span className="tpc-history-text">
            <span>{entry.action}</span>
            {entry.detail && <span>{entry.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  </details>
);

const DecisionDialog: React.FC<{
  decision: Exclude<Dialog, null>;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}> = ({ decision, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const rejecting = decision.kind === 'reject';
  const submit = async () => {
    if (rejecting && !reason.trim()) {
      setError('Nhập lý do từ chối.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason);
    } catch (failure: unknown) {
      setError(errorText(failure, 'Không xử lý được đề xuất.'));
      setBusy(false);
    }
  };
  return (
    <div className="tpc-backdrop">
      <div
        ref={dialogRef}
        className="tpc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="proposal-decision-title"
        onKeyDown={(event) => event.key === 'Escape' && !busy && onClose()}
      >
        <h2 id="proposal-decision-title">
          {rejecting ? 'Từ chối đề xuất?' : 'Chấp nhận đề xuất?'}
        </h2>
        <p>
          {rejecting
            ? `Lý do từ chối “${decision.proposal.title}” sẽ được gửi cho nhóm và lưu trong lịch sử.`
            : `Đề xuất “${decision.proposal.title}” sẽ chuyển ngay sang Đã đăng ký.`}
        </p>
        {rejecting && (
          <div className="tpc-form-field">
            <label htmlFor="proposal-reason">
              Lý do từ chối <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="proposal-reason"
              rows={4}
              value={reason}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'proposal-reason-error' : undefined}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="proposal-reason-error" className="tpc-form-error">
                {error}
              </p>
            )}
          </div>
        )}
        {!rejecting && error && (
          <p className="tpc-dialog-err" role="alert">
            {error}
          </p>
        )}
        <div className="tpc-dialog-actions">
          <button
            type="button"
            className="tpc-btn"
            disabled={busy}
            onClick={onClose}
          >
            Quay lại
          </button>
          <button
            type="button"
            className={`tpc-btn ${rejecting ? 'tpc-btn-danger' : 'tpc-btn-primary'}`}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy
              ? 'Đang xử lý...'
              : rejecting
                ? 'Từ chối đề xuất'
                : 'Chấp nhận'}
          </button>
        </div>
      </div>
    </div>
  );
};

// GV-Đề xuất: server chỉ trả các đơn có SupervisorId là tài khoản đang đăng nhập.
export const LecturerProposalsPage: React.FC<LecturerProposalsPageProps> = ({
  service = defaultService,
}) => {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState('');
  const [data, setData] = useState<LecturerProposals | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (id: string) => {
      try {
        setError(null);
        setData(await service.list(id));
      } catch (failure: unknown) {
        setError(errorText(failure, 'Không tải được đề xuất từ sinh viên.'));
      }
    },
    [service],
  );
  useEffect(() => {
    let disposed = false;
    service
      .listRounds()
      .then((items) => {
        if (disposed) return;
        const visible = items.filter((item) => item.status !== 'Nháp');
        setRounds(visible);
        setRoundId(
          (visible.find((item) => item.status === 'Đang diễn ra') ?? visible[0])
            ?.id ?? '',
        );
      })
      .catch((failure: unknown) => {
        if (!disposed)
          setError(errorText(failure, 'Không tải được đợt khóa luận.'));
      });
    return () => {
      disposed = true;
    };
  }, [service]);
  useEffect(() => {
    if (roundId) void load(roundId);
  }, [load, roundId]);
  const displayed = useMemo(
    () =>
      (data?.items ?? []).filter((proposal) =>
        tab === 'pending'
          ? proposal.status === 'Chờ GV duyệt'
          : proposal.status !== 'Chờ GV duyệt',
      ),
    [data, tab],
  );
  const afterChange = async (message: string) => {
    setDialog(null);
    toast.success(message);
    await load(roundId);
  };

  if (rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải đề xuất...
      </p>
    );
  if (rounds.length === 0)
    return (
      <div className="tpc-page">
        <div className="tpc-head">
          <div className="tpc-head-text">
            <h1>Đề xuất từ sinh viên</h1>
          </div>
        </div>
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Bạn chưa thuộc đợt khóa luận nào.</p>
        </section>
      </div>
    );
  return (
    <div className="tpc-page">
      <div className="tpc-round-row">
        <label htmlFor="proposal-round">Đợt</label>
        <select
          id="proposal-round"
          className="tpc-select"
          value={roundId}
          onChange={(event) => setRoundId(event.target.value)}
        >
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.name}
            </option>
          ))}
        </select>
      </div>
      <div className="tpc-head">
        <div className="tpc-head-text">
          <h1>Đề xuất từ sinh viên</h1>
          <p>Xử lý các đề xuất được gửi đích danh cho bạn.</p>
        </div>
      </div>
      {data?.load.level === 'over' && (
        <div className="tpc-banner tpc-banner-warn" role="note">
          Bạn đang có {data.load.count} đề tài, vượt mức tối đa {data.load.max};
          chấp nhận vẫn được phép.
        </div>
      )}
      <div className="tpc-seg" aria-label="Lọc đề xuất">
        <button
          type="button"
          aria-pressed={tab === 'pending'}
          onClick={() => setTab('pending')}
        >
          Chờ GV duyệt
        </button>
        <button
          type="button"
          aria-pressed={tab === 'processed'}
          onClick={() => setTab('processed')}
        >
          Đã xử lý
        </button>
      </div>
      {error && (
        <div className="tpc-banner tpc-banner-err" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        <p role="status" className="app-muted">
          Đang tải đề xuất...
        </p>
      ) : displayed.length === 0 ? (
        <section className="status-state app-empty">
          <h2>
            {tab === 'pending'
              ? 'Không có đề xuất đang chờ'
              : 'Chưa có đề xuất đã xử lý'}
          </h2>
          <p>
            {tab === 'pending'
              ? 'Các đề xuất mới gửi cho bạn sẽ xuất hiện tại đây.'
              : 'Lịch sử quyết định và đề xuất đã hủy sẽ xuất hiện tại đây.'}
          </p>
        </section>
      ) : (
        <div className="tpc-tablebox">
          <table
            className="tpc-table"
            aria-label={
              tab === 'pending' ? 'Đề xuất chờ duyệt' : 'Đề xuất đã xử lý'
            }
          >
            <thead>
              <tr>
                <th scope="col">Đề tài</th>
                <th scope="col">Nhóm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((proposal) => (
                <tr key={proposal.id}>
                  <td>
                    <div className="tpc-cell-title">
                      <strong>{proposal.title}</strong>
                      <span className="tpc-sub">
                        {proposal.field} · {proposal.description}
                      </span>
                      <History proposal={proposal} />
                    </div>
                  </td>
                  <td>
                    {proposal.group
                      .map(
                        (member) =>
                          `${member.name}${member.representative ? ' (đại diện)' : ''}`,
                      )
                      .join(', ')}
                  </td>
                  <td>
                    <TopicStatusChip status={proposal.status} />
                  </td>
                  <td>
                    {proposal.status === 'Chờ GV duyệt' && (
                      <div className="tpc-row-actions">
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm tpc-btn-primary"
                          onClick={() =>
                            setDialog({ kind: 'accept', proposal })
                          }
                        >
                          <Check size={14} aria-hidden="true" /> Chấp nhận
                        </button>
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          onClick={() =>
                            setDialog({ kind: 'reject', proposal })
                          }
                        >
                          <X size={14} aria-hidden="true" /> Từ chối
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && (
        <DecisionDialog
          decision={dialog}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            if (dialog.kind === 'accept') {
              await service.accept(dialog.proposal.id);
              await afterChange('Đã chấp nhận đề xuất.');
            } else {
              await service.reject(dialog.proposal.id, reason ?? '');
              await afterChange('Đã từ chối đề xuất.');
            }
          }}
        />
      )}
    </div>
  );
};
