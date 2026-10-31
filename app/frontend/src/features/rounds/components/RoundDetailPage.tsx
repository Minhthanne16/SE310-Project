'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronLeft, Lock } from 'lucide-react';
import '@/features/rounds/rounds.css';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusState } from '@/components/ui/StatusState';
import { RoundStatusPill } from '@/features/rounds/components/RoundChips';
import { RoundConfigTab } from '@/features/rounds/components/RoundConfigTab';
import { RoundGantt } from '@/features/rounds/components/RoundGantt';
import {
  RoundLifecycleDialog,
  type LifecycleKind,
} from '@/features/rounds/components/RoundLifecycleDialog';
import { RoundParticipantsTab } from '@/features/rounds/components/RoundParticipantsTab';
import {
  formatDate,
  roundSpan,
  studentNoun,
} from '@/features/rounds/roundUtils';
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

const TAB_IDS: RoundTab[] = ['tien-do', 'cau-hinh', 'giang-vien', 'sinh-vien'];

const isTab = (value: string | null): value is RoundTab =>
  TAB_IDS.some((t) => t === value);

const BACK_HREF = '/giao-vu/dot';

const GANTT_FOOTER =
  'Mốc lấy từ cấu hình đợt. Hệ thống tự gửi thông báo cho đúng đối tượng khi một mục mở, trước hạn và khi hết hạn. Sửa mốc trong tab Cấu hình; thay đổi được thông báo cho giảng viên và sinh viên của đợt.';
const GANTT_FOOTER_DONE =
  'Đợt đã kết thúc nên chỉ xem: không còn nút thao tác, không sửa mốc. Giảng viên và sinh viên vẫn xem được đợt.';

// Màn Chi tiết đợt khóa luận của Giáo vụ (docs/DESIGN/03; artboard
// GiaoVu-DotKhoaLuan): bốn tab Tiến độ, Cấu hình, Giảng viên, Sinh viên và các
// thao tác Mở / Kết thúc / Xóa đợt.
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
  // Xác nhận xóa đợt Nháp ngay trên trang (như artboard).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<RoundTab, HTMLButtonElement | null>>>(
    {},
  );

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

  useEffect(() => {
    if (confirmingDelete) deleteCancelRef.current?.focus();
  }, [confirmingDelete]);

  const closeDialog = useCallback(() => setDialog(null), []);

  if (loading)
    return (
      <p role="status" className="rnd-hint">
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
        <button type="button" className="rnd-btn" onClick={() => void load()}>
          Thử lại
        </button>
      </section>
    );

  const selectTab = (id: RoundTab) => {
    if (id !== tab && tab === 'cau-hinh' && configDirty) {
      setPendingTab(id);
      return;
    }
    setTabParam(id, 'replace');
  };

  const noun = studentNoun(round.program);
  const readOnly = round.status === 'Đã kết thúc';
  const span = roundSpan(round.milestones);
  const { topicSummary } = round;

  const tabs: { id: RoundTab; label: string }[] = [
    { id: 'tien-do', label: 'Tiến độ' },
    { id: 'cau-hinh', label: 'Cấu hình' },
    {
      id: 'giang-vien',
      label: `Giảng viên (${round.lecturerIds.length})`,
    },
    {
      id: 'sinh-vien',
      label: `${noun === 'học viên' ? 'Học viên' : 'Sinh viên'} (${round.studentIds.length})`,
    },
  ];

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next].id;
    selectTab(id);
    tabRefs.current[id]?.focus();
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await roundService.remove(round.id);
      toast.success(`Đã xóa đợt ${round.name}. Đợt không còn trong danh sách.`);
      router.push(BACK_HREF);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error && err.message
          ? err.message
          : 'Xóa đợt thất bại. Thử lại sau.',
      );
      setDeleting(false);
    }
  };

  return (
    <div className="rnd-stack-18">
      <nav aria-label="Đường dẫn" className="rnd-crumbs">
        <Link href={BACK_HREF}>
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          Đợt khóa luận
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{round.name}</span>
      </nav>

      <div className="rnd-detail-head">
        <div className="rnd-head-text">
          <span className="rnd-detail-title">
            <h1>{round.name}</h1>
            <RoundStatusPill status={round.status} />
          </span>
          <span className="rnd-meta">
            Bắt đầu {span ? formatDate(span.start) : 'chưa đặt ngày'} ·{' '}
            {round.lecturerIds.length} giảng viên · {round.studentIds.length}{' '}
            {noun}
          </span>
        </div>
        <div className="rnd-actions">
          {round.status === 'Nháp' && (
            <>
              <button
                type="button"
                className="rnd-btn rnd-btn-danger-outline"
                aria-expanded={confirmingDelete}
                onClick={() => {
                  setDeleteError(null);
                  setConfirmingDelete(true);
                }}
              >
                Xóa đợt
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-primary"
                aria-haspopup="dialog"
                onClick={() => setDialog('open')}
              >
                Mở đợt
              </button>
            </>
          )}
          {round.status === 'Đang diễn ra' && (
            <>
              <Link className="rnd-btn" href="/giao-vu/de-tai">
                Đề tài của đợt
              </Link>
              <button
                type="button"
                className="rnd-btn"
                aria-haspopup="dialog"
                onClick={() => setDialog('finish')}
              >
                Kết thúc đợt
              </button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div role="note" className="rnd-banner">
          <Lock size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            Đợt đã kết thúc nên chỉ xem: không sửa mốc thời gian, không thêm hay
            gỡ giảng viên, {noun}. Giảng viên và {noun} vẫn xem được đợt này.
          </span>
        </div>
      )}

      {confirmingDelete && round.status === 'Nháp' && (
        <div
          role="alertdialog"
          aria-label="Xác nhận xóa đợt"
          className="rnd-del-bar"
        >
          <p>
            <b>Xóa đợt Nháp này?</b> Cấu hình mốc và danh sách giảng viên,{' '}
            {noun} đã nhập sẽ bị xóa. Chỉ xóa được đợt chưa mở; đợt đã mở được
            giữ lại để tra cứu.
            {deleteError && (
              <>
                {' '}
                <span role="alert">
                  <b>{deleteError}</b>
                </span>
              </>
            )}
          </p>
          <span className="rnd-actions">
            <button
              ref={deleteCancelRef}
              type="button"
              className="rnd-btn"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="rnd-btn rnd-btn-danger"
              disabled={deleting}
              aria-busy={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Đang xóa...' : 'Xóa đợt'}
            </button>
          </span>
        </div>
      )}

      <div role="tablist" aria-label="Nội dung đợt" className="rnd-tabs">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`round-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="round-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="rnd-tab"
            onClick={() => selectTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="round-panel"
        aria-labelledby={`round-tab-${tab}`}
        className="rnd-panel"
      >
        {tab === 'tien-do' && (
          <section className="rnd-section rnd-section-flush">
            <RoundGantt
              round={round}
              today={roundService.today}
              heading={`Tiến độ đợt · ${round.name}`}
              footer={readOnly ? GANTT_FOOTER_DONE : GANTT_FOOTER}
              onAction={readOnly ? undefined : () => selectTab('cau-hinh')}
            />
            <div className="rnd-topics">
              <p>
                {topicSummary.total} đề tài
                {topicSummary.unpublishedCount > 0
                  ? `, ${topicSummary.unpublishedCount} chưa công bố`
                  : ''}
                .
              </p>
              {topicSummary.total > 0 && (
                <ul aria-label="Đề tài theo trạng thái">
                  {TOPIC_STATUSES.filter(
                    (s) => topicSummary.byStatus[s] > 0,
                  ).map((s) => (
                    <li
                      key={s}
                      className="rnd-pill rnd-pill-sm rnd-pill-neutral"
                    >
                      {s}: {topicSummary.byStatus[s]}
                    </li>
                  ))}
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
      </div>

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
    </div>
  );
};
