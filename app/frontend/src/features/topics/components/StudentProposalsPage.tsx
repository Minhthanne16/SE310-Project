'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/features/topics/topics.css';
import { formatDateTime } from '@/features/rounds/roundUtils';
import { useSession } from '@/features/auth/session/SessionProvider';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import { ProposalFormDialog } from '@/features/topics/components/ProposalFormDialog';
import {
  studentProposalService as defaultService,
  type StudentProposalService,
} from '@/features/topics/services/topicApiService';
import { useDialogFocus } from '@/lib/useDialogFocus';
import type { Round } from '@/types/round';
import type {
  ProposalInput,
  ProposalUpdateInput,
  StudentProposals,
  TopicDetailDto,
  TopicPerson,
} from '@/types/topic';

interface StudentProposalsPageProps {
  service?: StudentProposalService;
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; proposal: TopicDetailDto }
  | { kind: 'cancel'; proposal: TopicDetailDto }
  | null;

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const membersText = (proposal: TopicDetailDto) =>
  proposal.group
    .map(
      (member) => `${member.name}${member.representative ? ' (đại diện)' : ''}`,
    )
    .join(', ');

const History: React.FC<{ proposal: TopicDetailDto }> = ({ proposal }) => (
  <details>
    <summary>Lịch sử xử lý ({proposal.history.length})</summary>
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

const CancelDialog: React.FC<{
  proposal: TopicDetailDto;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ proposal, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>();
  return (
    <div className="tpc-backdrop">
      <div
        ref={dialogRef}
        className="tpc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-proposal-title"
        onKeyDown={(event) => event.key === 'Escape' && !busy && onClose()}
      >
        <h2 id="cancel-proposal-title">Hủy đề xuất?</h2>
        <p>
          Hủy “{proposal.title}” cho cả nhóm. Nhóm, thành viên và đại diện được
          giữ để đề xuất lại khi đợt còn mở.
        </p>
        {error && (
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
            className="tpc-btn tpc-btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch (reason: unknown) {
                setError(errorText(reason, 'Không hủy được đề xuất.'));
                setBusy(false);
              }
            }}
          >
            {busy ? 'Đang hủy...' : 'Hủy đề xuất'}
          </button>
        </div>
      </div>
    </div>
  );
};

// SV-Đơn đăng ký: đơn còn hiệu lực và lịch sử hủy tách riêng đúng PDR-012.
export const StudentProposalsPage: React.FC<StudentProposalsPageProps> = ({
  service = defaultService,
}) => {
  const { session } = useSession();
  const me = session.status === 'authenticated' ? session.user : null;
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const [data, setData] = useState<StudentProposals | null>(null);
  const [supervisors, setSupervisors] = useState<TopicPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(
    async (roundId: string) => {
      setError(null);
      try {
        const [next, people] = await Promise.all([
          service.listMine(roundId),
          service.listSupervisors(roundId),
        ]);
        setData(next);
        setSupervisors(people);
      } catch (reason: unknown) {
        setError(errorText(reason, 'Không tải được đơn đề xuất.'));
      }
    },
    [service],
  );

  useEffect(() => {
    let disposed = false;
    service
      .listRounds()
      .then((rounds) => {
        if (disposed) return;
        const selected =
          rounds.find((item) => item.status === 'Đang diễn ra') ?? null;
        setRound(selected);
        if (selected) void load(selected.id);
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setRound(null);
          setError(errorText(reason, 'Không tải được đợt khóa luận.'));
        }
      });
    return () => {
      disposed = true;
    };
  }, [load, service]);

  const active = useMemo(
    () =>
      (data?.items ?? []).filter((proposal) => proposal.status !== 'Đã hủy'),
    [data],
  );
  const history = useMemo(
    () =>
      (data?.items ?? []).filter((proposal) => proposal.status === 'Đã hủy'),
    [data],
  );
  const representative = !!me && data?.group?.representativeId === me.id;
  const canCreate =
    !!data &&
    data.registrationOpen &&
    active.length === 0 &&
    (!data.group || representative);

  const afterChange = async (message: string) => {
    setDialog(null);
    toast.success(message);
    if (round) await load(round.id);
  };

  if (round === undefined)
    return (
      <p role="status" className="app-muted">
        Đang tải đơn đăng ký...
      </p>
    );
  if (round === null)
    return (
      <div className="tpc-page">
        <div className="tpc-head">
          <div className="tpc-head-text">
            <h1>Đơn đăng ký của tôi</h1>
          </div>
        </div>
        <section className="status-state app-empty">
          <h2>Chưa có đợt đang diễn ra</h2>
          <p>Bạn chưa thuộc đợt khóa luận nào để theo dõi đề xuất.</p>
        </section>
      </div>
    );

  return (
    <div className="tpc-page">
      <div className="tpc-head">
        <div className="tpc-head-text">
          <h1>Đơn đăng ký của tôi</h1>
          <p>
            Theo dõi đề xuất của nhóm, lý do từ chối và lịch sử người thực hiện.
          </p>
        </div>
        <div className="tpc-actions">
          <button
            type="button"
            className="tpc-btn tpc-btn-primary"
            disabled={!canCreate}
            onClick={() => setDialog({ kind: 'create' })}
          >
            <Plus size={16} aria-hidden="true" /> Đề xuất đề tài
          </button>
        </div>
      </div>
      {data && (
        <p className="tpc-publish-line" role="status">
          {data.round.roundName}
          {data.registrationOpen
            ? ': đang mở đăng ký.'
            : ': đã hết thời gian đăng ký.'}
        </p>
      )}
      {data?.group && (
        <p className="tpc-note" role="note">
          Nhóm:{' '}
          {data.group.members
            .map(
              (member) =>
                `${member.name}${member.representative ? ' (đại diện)' : ''}`,
            )
            .join(', ')}
          .
          {!representative &&
            active.length === 0 &&
            ' Chỉ đại diện nhóm có thể gửi đề xuất.'}
        </p>
      )}
      {error && (
        <div className="tpc-banner tpc-banner-err" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        <p role="status" className="app-muted">
          Đang tải đề xuất...
        </p>
      ) : active.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đề xuất đang hoạt động</h2>
          <p>
            {canCreate
              ? 'Bạn có thể gửi đề xuất mới.'
              : 'Đề xuất chỉ mở khi đợt còn trong thời gian đăng ký và nhóm chưa có đơn hoặc đề tài đang hoạt động.'}
          </p>
        </section>
      ) : (
        <div className="tpc-tablebox">
          <table className="tpc-table" aria-label="Đề xuất đang hoạt động">
            <thead>
              <tr>
                <th scope="col">Đề tài</th>
                <th scope="col">Nhóm</th>
                <th scope="col">GV hướng dẫn</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {active.map((proposal) => (
                <tr key={proposal.id}>
                  <td>
                    <div className="tpc-cell-title">
                      <strong>{proposal.title}</strong>
                      <span className="tpc-sub">
                        {proposal.code} · {proposal.field}
                      </span>
                      <History proposal={proposal} />
                    </div>
                  </td>
                  <td>{membersText(proposal)}</td>
                  <td>{proposal.supervisor.name}</td>
                  <td>
                    <TopicStatusChip status={proposal.status} />
                  </td>
                  <td>
                    <div className="tpc-row-actions">
                      {proposal.status === 'Chờ GV duyệt' && representative && (
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          onClick={() => setDialog({ kind: 'edit', proposal })}
                        >
                          <Pencil size={14} aria-hidden="true" /> Sửa
                        </button>
                      )}
                      {proposal.status === 'Chờ GV duyệt' && (
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          onClick={() =>
                            setDialog({ kind: 'cancel', proposal })
                          }
                        >
                          <X size={14} aria-hidden="true" /> Hủy
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {history.length > 0 && (
        <section
          className="tpc-history-block"
          aria-labelledby="proposal-history-title"
        >
          <h2 id="proposal-history-title">Lịch sử đề xuất đã hủy</h2>
          <div className="tpc-tablebox">
            <table
              className="tpc-table tpc-table-compact"
              aria-label="Lịch sử đề xuất đã hủy"
            >
              <thead>
                <tr>
                  <th scope="col">Đề tài</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Lịch sử</th>
                </tr>
              </thead>
              <tbody>
                {history.map((proposal) => (
                  <tr key={proposal.id}>
                    <td>{proposal.title}</td>
                    <td>
                      <TopicStatusChip status={proposal.status} />
                    </td>
                    <td>
                      <History proposal={proposal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {dialog?.kind === 'create' && data && (
        <ProposalFormDialog
          roundId={round.id}
          supervisors={supervisors}
          existingGroup={!!data.group}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            await service.create(input as ProposalInput);
            await afterChange('Đã gửi đề xuất.');
          }}
        />
      )}
      {dialog?.kind === 'edit' && data && (
        <ProposalFormDialog
          roundId={round.id}
          proposal={dialog.proposal}
          supervisors={supervisors}
          existingGroup={!!data.group}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            await service.update(
              dialog.proposal.id,
              input as ProposalUpdateInput,
            );
            await afterChange('Đã lưu đề xuất.');
          }}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelDialog
          proposal={dialog.proposal}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await service.cancel(dialog.proposal.id);
            await afterChange('Đã hủy đề xuất cho cả nhóm.');
          }}
        />
      )}
    </div>
  );
};
