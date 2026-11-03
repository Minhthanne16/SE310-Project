'use client';

import React, { useRef } from 'react';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import {
  formatDate,
  registrationDaysLeft,
  registrationEnd,
  submissionClosed,
  submissionEnd,
} from '@/features/rounds/roundUtils';
import type { Round } from '@/types/round';

interface PublishTopicsDialogProps {
  round: Round;
  // "Hôm nay" (yyyy-MM-dd) để tính số ngày sinh viên còn đăng ký.
  today: string;
  // Số giảng viên chưa đạt số đề tài tối thiểu (chỉ cảnh báo).
  belowMin: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  // Chuyển sang tab Cấu hình để lùi ngày kết thúc mốc đăng ký.
  onGoToConfig: () => void;
}

// Hộp "Đóng và công bố danh sách đề tài?" ở tab Đề tài của chi tiết đợt. Công
// bố không bị chặn bởi hạn "GV gửi đề tài" (chỉ cảnh báo khi công bố sớm) nhưng
// bị chặn khi hạn sinh viên đăng ký đã qua.
export const PublishTopicsDialog: React.FC<PublishTopicsDialogProps> = ({
  round,
  today,
  belowMin,
  busy,
  error,
  onCancel,
  onConfirm,
  onGoToConfig,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const daysLeft = registrationDaysLeft(round, today);
  const regEnd = formatDate(registrationEnd(round));
  const blocked = daysLeft === 0;
  const early = !submissionClosed(round, today);

  return (
    <RoundModal
      titleId="publish-topics-title"
      size="md"
      busy={busy}
      onClose={onCancel}
      initialFocusRef={cancelRef}
    >
      <h2 id="publish-topics-title">Đóng và công bố danh sách đề tài?</h2>
      <p className="rnd-modal-text">
        {round.topicSummary.total} đề tài sẽ hiện cho sinh viên của đợt. Sau khi
        công bố, giảng viên không thêm hay xóa đề tài được nữa (chỉ sửa mô tả và
        yêu cầu của đề tài chưa có nhóm; Lĩnh vực bị khóa) và thao tác này không
        hoàn tác được.
      </p>
      {daysLeft !== null && daysLeft > 0 && (
        <p className="rnd-note rnd-note-ok">
          Sinh viên còn <b>{daysLeft} ngày</b> để đăng ký, đến 23:59 ngày{' '}
          {regEnd} (mốc “Công bố đề tài · SV đăng ký”). Hết hạn, đăng ký tự
          đóng.
        </p>
      )}
      {blocked && (
        <p role="alert" className="rnd-note rnd-note-bad">
          <b>Hạn sinh viên đăng ký đã qua</b> (23:59 ngày {regEnd}), công bố bây
          giờ sinh viên không còn ngày nào để đăng ký. Lùi ngày kết thúc mốc
          “Công bố đề tài · SV đăng ký” ở tab Cấu hình trước.
        </p>
      )}
      {early && (
        <p className="rnd-note rnd-note-warn">
          Chưa hết hạn giảng viên gửi đề tài (23:59 ngày{' '}
          {formatDate(submissionEnd(round))}). Công bố bây giờ thì giảng viên
          không gửi thêm được. Vẫn công bố được; hãy kiểm tra đã đủ đề tài.
        </p>
      )}
      {belowMin > 0 && (
        <p className="rnd-note rnd-note-warn">
          {belowMin} giảng viên chưa đạt số đề tài tối thiểu. Vẫn công bố được;
          đây chỉ là cảnh báo.
        </p>
      )}
      {error && (
        <p role="alert" className="rnd-note rnd-note-bad">
          {error}
        </p>
      )}
      <div className="rnd-modal-actions">
        <button
          ref={cancelRef}
          type="button"
          className="rnd-btn"
          onClick={onCancel}
          disabled={busy}
        >
          Để sau
        </button>
        {blocked && (
          <button type="button" className="rnd-btn" onClick={onGoToConfig}>
            Mở tab Cấu hình
          </button>
        )}
        <button
          type="button"
          className="rnd-btn rnd-btn-primary"
          onClick={onConfirm}
          disabled={busy || blocked}
          aria-busy={busy}
        >
          {busy ? 'Đang xử lý...' : 'Đóng và công bố'}
        </button>
      </div>
    </RoundModal>
  );
};
