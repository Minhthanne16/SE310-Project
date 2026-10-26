'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusState } from '@/components/ui/StatusState';
import {
  ProgramChip,
  RoundStatusChip,
} from '@/features/rounds/components/RoundChips';
import { RoundConfigTab } from '@/features/rounds/components/RoundConfigTab';
import { RoundGantt } from '@/features/rounds/components/RoundGantt';
import {
  RoundLifecycleDialog,
  type LifecycleKind,
} from '@/features/rounds/components/RoundLifecycleDialog';
import { RoundParticipantsTab } from '@/features/rounds/components/RoundParticipantsTab';
import { currentWeek } from '@/features/rounds/roundUtils';
import {
  RoundNotFoundError,
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { useUrlParam } from '@/lib/useUrlParam';
import { TOPIC_STATUSES, type Round, type RoundTab } from '@/types/round';

interface RoundDetailPageProps {
  roundId: string;
  roundService?: RoundService;
}

const TABS: { id: RoundTab; label: string }[] = [
  { id: 'tien-do', label: 'Tiến độ' },
  { id: 'cau-hinh', label: 'Cấu hình' },
  { id: 'giang-vien', label: 'Giảng viên' },
  { id: 'sinh-vien', label: 'Sinh viên' },
];

const isTab = (value: string | null): value is RoundTab =>
  TABS.some((t) => t.id === value);

const BACK_HREF = '/giao-vu/dot';

// Màn Chi tiết đợt khóa luận của Giáo vụ (docs/DESIGN/03): bốn tab Tiến độ,
// Cấu hình, Giảng viên, Sinh viên và các thao tác Mở / Kết thúc / Xóa đợt.
export const RoundDetailPage: React.FC<RoundDetailPageProps> = ({
  roundId,
  roundService = defaultRoundService,
}) => {
  const router = useRouter();
  const [tabParam, setTabParam] = useUrlParam('tab');
  const tab: RoundTab = isTab(tabParam) ? tabParam : 'tien-do';

  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<LifecycleKind | null>(null);
  // Cấu hình đang sửa dở: hỏi trước khi rời tab Cấu hình.
  const [configDirty, setConfigDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<RoundTab | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      setRound(await roundService.get(roundId));
    } catch (err: unknown) {
      if (err instanceof RoundNotFoundError) setNotFound(true);
      else
        setLoadError(
          err instanceof Error && err.message
            ? err.message
            : 'Không tải được đợt.',
        );
    } finally {
      setLoading(false);
    }
  }, [roundService, roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDialog = useCallback(() => setDialog(null), []);

  if (loading)
    return (
      <p role="status" className="app-muted">
        Đang tải đợt...
      </p>
    );

  if (notFound)
    return (
      <StatusState
        variant="notFound"
        title="Không tìm thấy đợt"
        description="Đợt không tồn tại hoặc đã bị xóa."
        action={{ href: BACK_HREF, label: '← Về danh sách đợt' }}
      />
    );

  if (loadError || !round)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đợt</h2>
        <p>{loadError ?? 'Thử lại sau.'}</p>
        <button
          type="button"
          className="app-button"
          onClick={() => void load()}
        >
          Thử lại
        </button>
      </section>
    );

  const week = currentWeek(round, roundService.today);
  const selectTab = (id: RoundTab) => {
    if (id !== tab && tab === 'cau-hinh' && configDirty) {
      setPendingTab(id);
      return;
    }
    setTabParam(id, 'replace');
  };
  const { topicSummary } = round;

  return (
    <>
      <Link className="app-back-link" href={BACK_HREF}>
        <ArrowLeft size={16} aria-hidden="true" />
        Tất cả đợt
      </Link>

      <div className="app-page-heading">
        <div className="app-heading-row">
          <h1>{round.name}</h1>
          <div className="app-toolbar-actions">
            {round.status === 'Nháp' && (
              <>
                <button
                  type="button"
                  className="app-button app-button-primary"
                  aria-haspopup="dialog"
                  onClick={() => setDialog('open')}
                >
                  Mở đợt
                </button>
                <button
                  type="button"
                  className="app-button app-button-danger"
                  aria-haspopup="dialog"
                  onClick={() => setDialog('remove')}
                >
                  Xóa đợt
                </button>
              </>
            )}
            {round.status === 'Đang diễn ra' && (
              <button
                type="button"
                className="app-button app-button-danger"
                aria-haspopup="dialog"
                onClick={() => setDialog('finish')}
              >
                Kết thúc đợt
              </button>
            )}
          </div>
        </div>
        <div className="app-chip-row">
          <ProgramChip program={round.program} />
          <RoundStatusChip status={round.status} />
          <span className="app-muted">{round.periodLabel}</span>
          {week !== null && round.status === 'Đang diễn ra' && (
            <span className="app-muted">Tuần {week}</span>
          )}
        </div>
      </div>

      <div className="app-segmented" role="group" aria-label="Nội dung đợt">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tien-do' && (
        <section className="app-card" aria-labelledby="round-progress-title">
          <div className="app-card-header">
            <h2 id="round-progress-title">Tiến độ</h2>
          </div>
          <RoundGantt
            round={round}
            today={roundService.today}
            onAction={() => selectTab('cau-hinh')}
          />
          <div className="round-topics">
            <p className="app-muted">
              {topicSummary.total} đề tài
              {topicSummary.unpublishedCount > 0
                ? `, ${topicSummary.unpublishedCount} chưa công bố`
                : ''}
              .
            </p>
            {topicSummary.total > 0 && (
              <ul className="app-chip-row" aria-label="Đề tài theo trạng thái">
                {TOPIC_STATUSES.filter((s) => topicSummary.byStatus[s] > 0).map(
                  (s) => (
                    <li key={s} className="app-chip">
                      {s}: {topicSummary.byStatus[s]}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'cau-hinh' && (
        <RoundConfigTab
          // Đổi trạng thái đợt (mở/kết thúc) thì bỏ bản nháp đang sửa.
          key={`${round.id}-${round.status}`}
          round={round}
          onDirtyChange={setConfigDirty}
          roundService={roundService}
          onSaved={setRound}
        />
      )}

      {tab === 'giang-vien' && (
        <RoundParticipantsTab
          kind="lecturer"
          round={round}
          roundService={roundService}
          onChanged={setRound}
        />
      )}

      {tab === 'sinh-vien' && (
        <RoundParticipantsTab
          kind="student"
          round={round}
          roundService={roundService}
          onChanged={setRound}
        />
      )}

      {pendingTab && (
        <ConfirmDialog
          title="Bỏ thay đổi?"
          description="Cấu hình mốc có thay đổi chưa lưu. Chuyển tab sẽ bỏ các thay đổi này."
          cancelLabel="Ở lại"
          confirmLabel="Bỏ thay đổi"
          danger
          onCancel={() => setPendingTab(null)}
          onConfirm={() => {
            const next = pendingTab;
            setPendingTab(null);
            setConfigDirty(false);
            setTabParam(next, 'replace');
          }}
        />
      )}

      {dialog && (
        <RoundLifecycleDialog
          kind={dialog}
          round={round}
          roundService={roundService}
          onClose={closeDialog}
          onDone={(kind, updated) => {
            setDialog(null);
            if (kind === 'remove') router.push(BACK_HREF);
            else if (updated) setRound(updated);
          }}
        />
      )}
    </>
  );
};
