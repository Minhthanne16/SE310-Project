'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import {
  earliestStart,
  finishBlockedMessage,
  formatDate,
  openBlockers,
  setupWarnings,
  studentNoun,
} from '@/features/rounds/roundUtils';
import type { RoundService } from '@/features/rounds/services/roundService';
import type { Round } from '@/types/round';

export type LifecycleKind = 'open' | 'finish' | 'remove';

interface RoundLifecycleDialogProps {
  kind: LifecycleKind;
  round: Round;
  roundService: RoundService;
  onClose: () => void;
  // Gọi sau khi thao tác thành công; round là đợt mới (không có khi xóa).
  onDone: (kind: LifecycleKind, round?: Round) => void;
  // Chuyển sang tab Cấu hình ngay trong trang chi tiết; không truyền thì dùng
  // liên kết tới trang chi tiết của đợt.
  onGoToConfig?: () => void;
}

// Hộp xác nhận Mở đợt / Kết thúc đợt / Xóa đợt dùng chung cho danh sách và
// chi tiết đợt (artboard GiaoVu-DanhSachDot, GiaoVu-DotKhoaLuan). Mở đợt bị
// chặn khi chín mốc chưa đủ ngày hợp lệ (PDR-032); thiếu giảng viên, sinh viên
// (PDR-033) chỉ cảnh báo; Kết thúc đợt bị chặn khi còn đề tài chưa ở trạng
// thái kết thúc (PDR-031): docs/DESIGN/03.
export const RoundLifecycleDialog: React.FC<RoundLifecycleDialogProps> = ({
  kind,
  round,
  roundService,
  onClose,
  onDone,
  onGoToConfig,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'open') {
        const updated = await roundService.open(round.id);
        toast.success(
          'Đã mở đợt. Giảng viên và sinh viên trong đợt sẽ được thông báo.',
        );
        onDone(kind, updated);
      } else if (kind === 'finish') {
        const updated = await roundService.finish(round.id);
        toast.success(
          'Đã kết thúc đợt. Giảng viên và sinh viên nhận thông báo; đợt vẫn hiện để họ xem lại đề tài và kết quả.',
        );
        onDone(kind, updated);
      } else {
        await roundService.remove(round.id);
        toast.success(
          `Đã xóa đợt ${round.name}. Đợt không còn trong danh sách.`,
        );
        onDone(kind);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Thao tác thất bại. Thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  };

  const noun = studentNoun(round.program);
  const titleId = 'round-lifecycle-title';
  const start = earliestStart(round);

  const actions = (
    cancelLabel: string,
    confirmLabel: string,
    confirmClass: string,
    confirmDisabled = false,
  ) => (
    <div className="rnd-modal-actions">
      <button
        ref={cancelRef}
        type="button"
        className="rnd-btn"
        disabled={busy}
        onClick={onClose}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`rnd-btn ${confirmClass}`}
        disabled={busy || confirmDisabled}
        aria-busy={busy}
        onClick={() => void run()}
      >
        {busy ? 'Đang xử lý...' : confirmLabel}
      </button>
    </div>
  );

  const errorBox = error && (
    <p role="alert" className="rnd-note rnd-note-bad">
      {error}
    </p>
  );

  if (kind === 'open') {
    const warnings = setupWarnings(round);
    const blockers = openBlockers(round);
    return (
      <RoundModal
        titleId={titleId}
        size="md"
        busy={busy}
        onClose={onClose}
        initialFocusRef={cancelRef}
      >
        <h2 id={titleId}>Mở đợt {round.name}?</h2>
        <p className="rnd-modal-text">
          Hệ thống gửi thông báo cho {round.lecturerIds.length} giảng viên và{' '}
          {round.studentIds.length} {noun} có tên trong đợt. Đợt sẽ hiện ở Trang
          chủ của họ và mốc đầu tiên bắt đầu tính từ{' '}
          {start ? formatDate(start) : 'ngày bạn đặt cho mốc đầu tiên'}.
        </p>
        {blockers.length > 0 && (
          <div role="alert" className="rnd-note rnd-note-bad">
            <b>
              Chưa mở được đợt: chín mốc phải có ngày hợp lệ và đúng thứ tự.
            </b>
            <ul>
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {onGoToConfig ? (
              <button type="button" className="rnd-link" onClick={onGoToConfig}>
                Đi tới tab Cấu hình
              </button>
            ) : (
              <Link
                className="rnd-link"
                href={`/giao-vu/dot/${encodeURIComponent(round.id)}?tab=cau-hinh`}
              >
                Đi tới tab Cấu hình
              </Link>
            )}
          </div>
        )}
        {warnings.length > 0 ? (
          <p className="rnd-note rnd-note-warn">
            {`Còn ${warnings.length} việc chưa xong: ${warnings.join(', ')}. Vẫn mở được, có thể bổ sung sau.`}
          </p>
        ) : (
          blockers.length === 0 && (
            <p className="rnd-note rnd-note-ok">Cấu hình đã đủ.</p>
          )
        )}
        {errorBox}
        {actions('Để sau', 'Mở đợt', 'rnd-btn-primary', blockers.length > 0)}
      </RoundModal>
    );
  }

  if (kind === 'finish') {
    const pending = round.topicSummary.pendingResultCount;
    const total = round.topicSummary.total;
    const blocked = finishBlockedMessage(round) !== null;
    return (
      <RoundModal
        role="alertdialog"
        titleId={titleId}
        size="md"
        busy={busy}
        onClose={onClose}
        initialFocusRef={cancelRef}
      >
        <h2 id={titleId}>Kết thúc đợt {round.name}?</h2>
        <p className="rnd-modal-text">
          Sau khi kết thúc, đợt chuyển sang chỉ xem: không sửa mốc thời gian,
          không thêm hay gỡ giảng viên, {noun}. Giảng viên và {noun} vẫn xem
          được đợt, đề tài và kết quả của mình. Đợt không mở lại được.
        </p>
        {blocked ? (
          <p role="alert" className="rnd-note rnd-note-bad">
            <b>Còn {pending} đề tài chưa công bố kết quả.</b> Công bố hết ở
            trang{' '}
            <Link className="rnd-link" href="/giao-vu/ket-qua">
              Kết quả
            </Link>{' '}
            rồi mới kết thúc được đợt. Đề tài Không có nhóm không tính.
          </p>
        ) : (
          total > 0 && (
            <p className="rnd-note rnd-note-ok">
              Cả {total} đề tài đã công bố kết quả.
            </p>
          )
        )}
        {errorBox}
        {actions('Để sau', 'Kết thúc đợt', 'rnd-btn-primary', blocked)}
      </RoundModal>
    );
  }

  return (
    <RoundModal
      role="alertdialog"
      titleId={titleId}
      size="sm"
      busy={busy}
      onClose={onClose}
      initialFocusRef={cancelRef}
    >
      <h2 id={titleId}>Xóa đợt {round.name}?</h2>
      <p className="rnd-modal-text">
        Cấu hình mốc và danh sách giảng viên, sinh viên đã nhập sẽ bị xóa, không
        khôi phục được. Chỉ xóa được đợt Nháp; đợt đã mở được giữ lại để tra
        cứu.
      </p>
      {errorBox}
      {actions('Hủy', 'Xóa đợt', 'rnd-btn-danger')}
    </RoundModal>
  );
};
