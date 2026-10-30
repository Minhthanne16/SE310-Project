'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import '@/features/rounds/rounds.css';
import {
  AddParticipantsDialog,
  type AddMode,
} from '@/features/rounds/components/AddParticipantsDialog';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import { studentNoun } from '@/features/rounds/roundUtils';
import type { RoundService } from '@/features/rounds/services/roundService';
import type { Participant, ParticipantKind, Round } from '@/types/round';

interface RoundParticipantsTabProps {
  kind: ParticipantKind;
  round: Round;
  roundService: RoundService;
  onChanged: (round: Round) => void;
}

const NOTES: Record<ParticipantKind, string> = {
  lecturer:
    'Giảng viên được thêm từ tài khoản đã tạo ở trang Người dùng. Chỉ giảng viên có tên ở đây mới gửi đề tài, được sinh viên chọn hướng dẫn và được phân công phản biện, hội đồng trong đợt. Một giảng viên có thể tham gia nhiều đợt cùng lúc. Giảng viên gỡ được khỏi đợt (quy tắc khóa gỡ vì đã có dữ liệu chỉ áp dụng cho sinh viên).',
  student:
    'Sinh viên được thêm từ tài khoản đã tạo ở trang Người dùng. Sinh viên chỉ thấy đợt mình được ghi danh và chỉ thuộc một đợt đang diễn ra. Chỉ gỡ khỏi đợt được sinh viên chưa có dữ liệu trong đợt; sinh viên đã có dữ liệu thì không gỡ được.',
};

// Tab Giảng viên / Sinh viên của chi tiết đợt: danh sách, tìm kiếm, thêm (chọn
// hoặc nhập mã) và gỡ khỏi đợt. Sinh viên đã có dữ liệu không gỡ được.
export const RoundParticipantsTab: React.FC<RoundParticipantsTabProps> = ({
  kind,
  round,
  roundService,
  onChanged,
}) => {
  const isStudent = kind === 'student';
  const noun = isStudent ? studentNoun(round.program) : 'giảng viên';
  const heading = isStudent
    ? noun === 'học viên'
      ? 'Học viên'
      : 'Sinh viên'
    : 'Giảng viên';
  const addLabel = isStudent ? `Thêm ${noun}` : 'Thêm giảng viên';
  const unitLabel = isStudent ? 'Lớp' : 'Bộ môn';

  const [everyone, setEveryone] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void roundService.listParticipants(kind).then((list) => {
      if (!cancelled) setEveryone(list);
    });
    return () => {
      cancelled = true;
    };
  }, [roundService, kind]);

  const ids = isStudent ? round.studentIds : round.lecturerIds;
  const keyword = search.trim().toLowerCase();
  const members = ids
    .map((id) => everyone.find((p) => p.id === id))
    .filter((p): p is Participant => !!p)
    .filter(
      (p) =>
        !keyword ||
        p.code.toLowerCase().includes(keyword) ||
        p.name.toLowerCase().includes(keyword) ||
        p.unit.toLowerCase().includes(keyword),
    );
  const readOnly = round.status === 'Đã kết thúc';
  // Chỉ sinh viên có dữ liệu trong đợt này bị khóa (03: Chi tiết đợt).
  const isLocked = (p: Participant) =>
    isStudent && round.lockedStudentIds.includes(p.id);

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
      toast.success(
        `Đã gỡ ${removing.name} khỏi đợt. Có thể thêm lại bằng nút ${addLabel} nếu cần.`,
      );
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

  const colCount = readOnly ? 3 : 4;

  return (
    <div className="rnd-panel" aria-label={`Danh sách ${noun}`}>
      <div className="rnd-people-tools">
        <div className="rnd-people-search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            aria-label={`Tìm ${noun}`}
            placeholder={
              isStudent
                ? `Tìm ${noun} theo mã, họ tên, lớp`
                : 'Tìm giảng viên theo mã, họ tên, bộ môn'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              className="rnd-btn rnd-btn-lg"
              aria-haspopup="dialog"
              onClick={() => setAdding('codes')}
            >
              Nhập theo mã
            </button>
            <button
              type="button"
              className="rnd-btn rnd-btn-lg rnd-btn-primary"
              aria-haspopup="dialog"
              onClick={() => setAdding('pick')}
            >
              {addLabel}
            </button>
          </>
        )}
      </div>

      {members.length === 0 ? (
        <section className="status-state app-empty">
          <h2>
            {ids.length === 0
              ? `Chưa có ${noun} trong đợt`
              : `Không có ${noun} phù hợp`}
          </h2>
          <p>
            {ids.length === 0
              ? readOnly
                ? 'Đợt đã kết thúc nên không thêm được nữa.'
                : `Bấm “${addLabel}” để chọn từ danh sách hoặc nhập mã.`
              : 'Thử đổi từ khóa tìm kiếm.'}
          </p>
        </section>
      ) : (
        <div className="rnd-people-box">
          <table className="rnd-table rnd-table-people">
            <thead>
              <tr>
                <th scope="col">{heading}</th>
                <th scope="col">{unitLabel}</th>
                <th scope="col">Trạng thái</th>
                {!readOnly && (
                  <th scope="col" colSpan={colCount - 3}>
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((p) => {
                const locked = isLocked(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="rnd-person">
                        <b>{p.name}</b>
                        <span>{p.code}</span>
                      </span>
                    </td>
                    <td>{p.unit}</td>
                    <td>
                      <span
                        className={`rnd-pill ${
                          !isStudent
                            ? 'rnd-pill-ok'
                            : locked
                              ? 'rnd-pill-purple'
                              : 'rnd-pill-neutral'
                        }`}
                      >
                        {!isStudent
                          ? 'Đang tham gia'
                          : locked
                            ? 'Đã có dữ liệu'
                            : 'Chưa có dữ liệu'}
                      </span>
                    </td>
                    {!readOnly && (
                      <td>
                        <span className="rnd-remove-cell">
                          <button
                            type="button"
                            className="rnd-btn rnd-btn-danger-outline"
                            aria-haspopup="dialog"
                            aria-label={`Gỡ ${p.name} khỏi đợt`}
                            disabled={locked}
                            aria-describedby={
                              locked ? `locked-${p.id}` : undefined
                            }
                            onClick={() => {
                              setRemoveError(null);
                              setRemoving(p);
                            }}
                          >
                            Gỡ khỏi đợt
                          </button>
                          {locked && (
                            <small id={`locked-${p.id}`}>
                              Đã có dữ liệu, không gỡ được
                            </small>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="rnd-foot">{NOTES[kind]}</p>

      {adding && (
        <AddParticipantsDialog
          kind={kind}
          round={round}
          roundService={roundService}
          initialMode={adding}
          onClose={() => setAdding(null)}
          onAdded={(updated, added) => {
            setAdding(null);
            toast.success(
              `Đã thêm ${added} ${noun} vào đợt. ${
                round.status === 'Nháp'
                  ? 'Họ sẽ thấy đợt này khi đợt được mở.'
                  : 'Họ nhận thông báo và thấy đợt này ở lần đăng nhập tiếp theo.'
              }`,
            );
            onChanged(updated);
          }}
        />
      )}

      {removing && (
        <RoundModal
          role="alertdialog"
          titleId="remove-participant-title"
          busy={busy}
          onClose={() => setRemoving(null)}
          initialFocusRef={cancelRef}
        >
          <h2 id="remove-participant-title">Gỡ {removing.name} khỏi đợt?</h2>
          <p className="rnd-modal-text">
            Người này không còn thấy đợt này.{' '}
            {isStudent
              ? 'Sinh viên này chưa có dữ liệu trong đợt. Có thể thêm lại sau nếu cần.'
              : 'Có thể thêm lại sau nếu cần.'}
          </p>
          {removeError && (
            <p role="alert" className="rnd-note rnd-note-bad">
              {removeError}
            </p>
          )}
          <div className="rnd-modal-actions">
            <button
              ref={cancelRef}
              type="button"
              className="rnd-btn"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="rnd-btn rnd-btn-danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void confirmRemove()}
            >
              {busy ? 'Đang xử lý...' : 'Gỡ khỏi đợt'}
            </button>
          </div>
        </RoundModal>
      )}
    </div>
  );
};
