'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { AddParticipantsDialog } from '@/features/rounds/components/AddParticipantsDialog';
import type { RoundService } from '@/features/rounds/services/roundService';
import type { Participant, ParticipantKind, Round } from '@/types/round';

interface RoundParticipantsTabProps {
  kind: ParticipantKind;
  round: Round;
  roundService: RoundService;
  onChanged: (round: Round) => void;
}

const COPY: Record<
  ParticipantKind,
  { plural: string; unit: string; add: string }
> = {
  lecturer: { plural: 'giảng viên', unit: 'Bộ môn', add: 'Thêm giảng viên' },
  student: { plural: 'sinh viên', unit: 'Lớp', add: 'Thêm sinh viên' },
};

// Tab Giảng viên / Sinh viên của chi tiết đợt: danh sách, tìm kiếm, thêm (chọn
// hoặc nhập mã) và gỡ khỏi đợt. Người đã có dữ liệu không gỡ được.
export const RoundParticipantsTab: React.FC<RoundParticipantsTabProps> = ({
  kind,
  round,
  roundService,
  onChanged,
}) => {
  const copy = COPY[kind];
  const [everyone, setEveryone] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void roundService.listParticipants(kind).then((list) => {
      if (!cancelled) setEveryone(list);
    });
    return () => {
      cancelled = true;
    };
  }, [roundService, kind]);

  const ids = kind === 'student' ? round.studentIds : round.lecturerIds;
  const keyword = search.trim().toLowerCase();
  const members = ids
    .map((id) => everyone.find((p) => p.id === id))
    .filter((p): p is Participant => !!p)
    .filter(
      (p) =>
        !keyword ||
        p.code.toLowerCase().includes(keyword) ||
        p.name.toLowerCase().includes(keyword),
    );
  const readOnly = round.status === 'Đã kết thúc';

  const confirmRemove = async () => {
    if (!removing || busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const updated = await roundService.removeParticipant(
        round.id,
        kind,
        removing.id,
      );
      toast.success(`Đã gỡ ${removing.name} khỏi đợt.`);
      setRemoving(null);
      onChanged(updated);
    } catch (err: unknown) {
      setRemoveError(
        err instanceof Error && err.message
          ? err.message
          : 'Không gỡ được. Thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-card" aria-label={`Danh sách ${copy.plural}`}>
      <div className="app-card-header">
        <h2>
          {copy.plural === 'giảng viên' ? 'Giảng viên' : 'Sinh viên'} (
          {ids.length})
        </h2>
        <div className="app-toolbar-actions">
          <div className="app-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label={`Tìm ${copy.plural}`}
              placeholder="Tìm theo mã hoặc họ tên"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="app-button app-button-primary"
            aria-haspopup="dialog"
            disabled={readOnly}
            onClick={() => setAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />
            {copy.add}
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <section className="status-state app-empty">
          <h2>
            {ids.length === 0
              ? `Chưa có ${copy.plural} trong đợt`
              : `Không có ${copy.plural} phù hợp`}
          </h2>
          <p>
            {ids.length === 0
              ? `Bấm “${copy.add}” để chọn từ danh sách hoặc nhập mã.`
              : 'Thử đổi từ khóa tìm kiếm.'}
          </p>
        </section>
      ) : (
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th scope="col">Mã</th>
                <th scope="col">Họ tên</th>
                <th scope="col">{copy.unit}</th>
                <th scope="col">Dữ liệu</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.unit}</td>
                  <td>
                    {p.hasData ? (
                      <span className="app-chip app-chip-info">
                        Đã có dữ liệu
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="app-button app-button-small app-button-danger"
                      aria-haspopup="dialog"
                      aria-label={`Gỡ ${p.name} khỏi đợt`}
                      disabled={readOnly}
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(p);
                      }}
                    >
                      Gỡ khỏi đợt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddParticipantsDialog
          kind={kind}
          round={round}
          roundService={roundService}
          onClose={() => setAdding(false)}
          onAdded={(updated, added) => {
            setAdding(false);
            toast.success(`Đã thêm ${added} ${copy.plural}.`);
            onChanged(updated);
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Gỡ ${removing.name} khỏi đợt?`}
          description={
            removing.hasData
              ? `${removing.name} đã có dữ liệu (đề tài, điểm...) trong hệ thống nên không thể gỡ khỏi đợt.`
              : `${removing.name} sẽ không còn trong đợt này. Có thể thêm lại sau.`
          }
          cancelLabel="Giữ lại"
          confirmLabel="Gỡ khỏi đợt"
          danger
          busy={busy}
          error={removeError}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </section>
  );
};
