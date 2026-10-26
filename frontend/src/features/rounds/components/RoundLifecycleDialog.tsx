'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { finishWarning, setupWarnings } from '@/features/rounds/roundUtils';
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
}

// Hộp xác nhận Mở đợt / Kết thúc đợt / Xóa đợt dùng chung cho danh sách và
// chi tiết đợt. Cảnh báo (việc chưa xong, đề tài chưa công bố) không chặn.
export const RoundLifecycleDialog: React.FC<RoundLifecycleDialogProps> = ({
  kind,
  round,
  roundService,
  onClose,
  onDone,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        toast.success('Đã kết thúc đợt.');
        onDone(kind, updated);
      } else {
        await roundService.remove(round.id);
        toast.success('Đã xóa đợt.');
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

  if (kind === 'open') {
    const warnings = setupWarnings(round);
    return (
      <ConfirmDialog
        title={`Mở đợt “${round.name}”?`}
        description={
          'Giảng viên và sinh viên trong đợt sẽ được thông báo và thấy đợt này.' +
          (warnings.length > 0
            ? ` Việc chưa xong: ${warnings.join('; ')}. Bạn vẫn có thể mở đợt.`
            : '')
        }
        cancelLabel="Hủy"
        confirmLabel="Mở đợt"
        busy={busy}
        error={error}
        onCancel={onClose}
        onConfirm={() => void run()}
      />
    );
  }

  if (kind === 'finish') {
    const warning = finishWarning(round);
    return (
      <ConfirmDialog
        title={
          warning
            ? 'Kết thúc đợt · còn đề tài chưa công bố'
            : `Kết thúc đợt “${round.name}”?`
        }
        description={
          warning
            ? `${warning} Đợt “${round.name}” vẫn kết thúc được, nhưng sẽ ngừng nhận thao tác mới và không mở lại được.`
            : 'Đợt sẽ ngừng nhận thao tác mới và không mở lại được.'
        }
        cancelLabel="Giữ đợt"
        confirmLabel="Kết thúc đợt"
        danger
        busy={busy}
        error={error}
        onCancel={onClose}
        onConfirm={() => void run()}
      />
    );
  }

  return (
    <ConfirmDialog
      title={`Xóa đợt “${round.name}”?`}
      description="Đợt Nháp sẽ bị xóa hẳn và không thể khôi phục."
      cancelLabel="Giữ đợt"
      confirmLabel="Xóa đợt"
      danger
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={() => void run()}
    />
  );
};
