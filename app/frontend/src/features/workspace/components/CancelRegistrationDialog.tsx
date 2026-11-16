'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { TopicDetailDto } from '@/types/topic';

interface CancelRegistrationDialogProps {
  topic: TopicDetailDto;
  onCancel: () => void;
  onConfirmCancel: (topicId: string) => Promise<void>;
}

export const CancelRegistrationDialog: React.FC<
  CancelRegistrationDialogProps
> = ({ topic, onCancel, onConfirmCancel }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirmCancel(topic.id);
      toast.success(`Đã hủy ghi danh đề tài ${topic.code}.`);
      router.replace('/sv/de-tai');
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Không hủy ghi danh được.',
      );
    } finally {
      setBusy(false);
    }
  };

  const description = `Việc hủy áp dụng cho cả nhóm: đề tài ${topic.code} · ${topic.title} trở về danh sách chưa đăng ký để các nhóm khác có thể đăng ký.\n\nNhóm vẫn giữ nguyên thành viên và có thể ghi danh lại đề tài còn trống trong thời gian đăng ký.`;

  return (
    <ConfirmDialog
      title="Hủy ghi danh đề tài?"
      description={description}
      cancelLabel="Giữ ghi danh"
      confirmLabel="Hủy ghi danh"
      danger={true}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onConfirm={handleConfirm}
    />
  );
};
