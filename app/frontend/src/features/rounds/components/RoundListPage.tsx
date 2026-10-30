'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import '@/features/rounds/rounds.css';
import { RoundStatusPill } from '@/features/rounds/components/RoundChips';
import { CreateRoundDialog } from '@/features/rounds/components/CreateRoundDialog';
import {
  RoundLifecycleDialog,
  type LifecycleKind,
} from '@/features/rounds/components/RoundLifecycleDialog';
import { deriveTasks, roundProgress } from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  ROUND_PROGRAMS,
  type Round,
  type RoundFilters,
  type RoundProgram,
  type RoundStatus,
} from '@/types/round';

interface RoundListPageProps {
  roundService?: RoundService;
}

type StatusFilter = RoundStatus | 'Tất cả';

const PAGE_SIZE = 6;
// Thứ tự trong artboard: Đang diễn ra, Nháp, Đã kết thúc, Tất cả.
const STATUS_ORDER: StatusFilter[] = [
  'Đang diễn ra',
  'Nháp',
  'Đã kết thúc',
  'Tất cả',
];

// Màn Danh sách đợt khóa luận của Giáo vụ (docs/DESIGN/03, artboard
// GiaoVu-DanhSachDot). Lọc phía dịch vụ, phân trang phía client.
export const RoundListPage: React.FC<RoundListPageProps> = ({
  roundService = defaultRoundService,
}) => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('Đang diễn ra');
  const [program, setProgram] = useState<RoundProgram | ''>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState<{ copyFromId: string } | null>(null);
  const [dialog, setDialog] = useState<{
    kind: LifecycleKind;
    roundId: string;
  } | null>(null);

  // Mỗi lần lọc/tải lại tăng requestRef; phản hồi cũ bị bỏ qua.
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    const filters: RoundFilters = { status, program };
    Promise.all([roundService.list(filters), roundService.list()])
      .then(([filtered, everything]) => {
        if (request !== requestRef.current) return;
        setRounds(filtered);
        setAllRounds(everything);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (request !== requestRef.current) return;
        setLoadError(
          err instanceof Error && err.message
            ? err.message
            : 'Không tải được danh sách đợt.',
        );
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [roundService, status, program, reload]);

  const reloadList = () => setReload((n) => n + 1);

  const pageCount = Math.max(1, Math.ceil(rounds.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = rounds.slice(firstIndex, currentPage * PAGE_SIZE);
  const dialogRound = dialog
    ? allRounds.find((r) => r.id === dialog.roundId)
    : undefined;
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeCreate = useCallback(() => setCreating(null), []);

  // Số đợt theo trạng thái trong chương trình đang lọc (như artboard).
  const inProgram = allRounds.filter((r) => !program || r.program === program);
  const countOf = (s: StatusFilter) =>
    inProgram.filter((r) => s === 'Tất cả' || r.status === s).length;

  const live = allRounds.filter((r) => r.status === 'Đang diễn ra');
  const pending = live.reduce(
    (n, r) => n + deriveTasks(r, roundService.today).length,
    0,
  );
  const stats = [
    { label: 'Đợt đang diễn ra', value: live.length },
    {
      label: 'Giảng viên tham gia',
      value: live.reduce((n, r) => n + r.lecturerIds.length, 0),
    },
    {
      label: 'Sinh viên tham gia',
      value: live.reduce((n, r) => n + r.studentIds.length, 0),
    },
  ];

  const openCopy = () => {
    const source =
      allRounds.find((r) => r.status === 'Đã kết thúc') ?? allRounds[0];
    setCreating({ copyFromId: source?.id ?? '' });
  };

  return (
    <div className="rnd-stack">
      <div className="rnd-head">
        <div className="rnd-head-text">
          <h1 className="rnd-title">Đợt khóa luận</h1>
          <p className="rnd-lead">
            Các đợt của mọi chương trình. Bấm vào một đợt để xem tiến độ, cấu
            hình mốc và ghi danh giảng viên, sinh viên.
          </p>
        </div>
        <div className="rnd-actions">
          <button
            type="button"
            className="rnd-btn rnd-btn-lg"
            aria-haspopup="dialog"
            disabled={allRounds.length === 0}
            onClick={openCopy}
          >
            Sao chép từ đợt cũ
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-lg rnd-btn-primary"
            aria-haspopup="dialog"
            onClick={() => setCreating({ copyFromId: '' })}
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Tạo đợt mới
          </button>
        </div>
      </div>

      <dl className="rnd-stats" aria-label="Tổng quan các đợt đang diễn ra">
        {stats.map((s) => (
          <div key={s.label} className="rnd-stat">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
        <div className="rnd-stat rnd-stat-warn">
          <dt>Việc cần xử lý</dt>
          <dd>{pending}</dd>
        </div>
      </dl>

      <div className="rnd-filters">
        <div role="group" aria-label="Lọc theo trạng thái" className="rnd-seg">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s} ({countOf(s)})
            </button>
          ))}
        </div>
        <label className="rnd-inline-field">
          Chương trình
          <select
            className="rnd-select"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value as RoundProgram | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả chương trình</option>
            {ROUND_PROGRAMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!loaded && loading ? (
        <p role="status" className="rnd-hint">
          Đang tải danh sách đợt...
        </p>
      ) : loadError ? (
        <section className="status-state" role="alert">
          <h2>Không tải được danh sách</h2>
          <p>{loadError}</p>
          <button type="button" className="rnd-btn" onClick={reloadList}>
            Thử lại
          </button>
        </section>
      ) : (
        <div className="rnd-list" aria-busy={loading}>
          <div className="rnd-list-scroll">
            <div className="rnd-list-inner">
              <div className="rnd-cols rnd-cols-head" aria-hidden="true">
                <span>Đợt</span>
                <span>Trạng thái</span>
                <span>Tiến độ · mốc hiện tại</span>
                <span>Giảng viên</span>
                <span>Sinh viên</span>
                <span>Cần xử lý</span>
                <span />
              </div>
              <ul className="rnd-rows" aria-label="Danh sách đợt">
                {visible.map((round) => {
                  const info = roundProgress(round, roundService.today);
                  const tasks = deriveTasks(round, roundService.today);
                  const isDraft = round.status === 'Nháp';
                  return (
                    <li key={round.id} className="rnd-cols rnd-row">
                      <Link
                        className="rnd-row-link"
                        href={`/giao-vu/dot/${round.id}`}
                        aria-label={round.name}
                      >
                        <span className="rnd-eyebrow">{round.program}</span>
                        <span className="rnd-row-name">
                          {round.periodLabel}
                        </span>
                      </Link>
                      <span>
                        <RoundStatusPill status={round.status} />
                      </span>
                      <span className="rnd-progress">
                        <span className="rnd-progress-line">
                          <b>{info.milestone}</b>
                          <span>{info.weeks}</span>
                        </span>
                        <span
                          className={`rnd-bar${round.status === 'Đang diễn ra' ? ' rnd-bar-live' : ''}`}
                          aria-hidden="true"
                        >
                          <span style={{ width: `${info.percent}%` }} />
                        </span>
                      </span>
                      <span>{round.lecturerIds.length}</span>
                      <span>
                        {round.studentIds.length}
                        {round.program === 'Thạc sĩ' ? ' HV' : ''}
                      </span>
                      <ul className="rnd-flags" aria-label="Việc cần xử lý">
                        {tasks.length === 0 ? (
                          <li className="rnd-none">Không có</li>
                        ) : (
                          tasks.map((t) => <li key={t.id}>{t.text}</li>)
                        )}
                      </ul>
                      <span className="rnd-row-actions">
                        {isDraft ? (
                          <>
                            <button
                              type="button"
                              className="rnd-icon-btn"
                              aria-haspopup="dialog"
                              aria-label={`Xóa đợt ${round.name}`}
                              title="Xóa đợt"
                              onClick={() =>
                                setDialog({ kind: 'remove', roundId: round.id })
                              }
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="rnd-btn rnd-btn-sm rnd-btn-primary"
                              aria-haspopup="dialog"
                              aria-label={`Mở đợt ${round.name}`}
                              onClick={() =>
                                setDialog({ kind: 'open', roundId: round.id })
                              }
                            >
                              Mở đợt
                            </button>
                          </>
                        ) : (
                          <Link
                            className="rnd-icon-link"
                            href={`/giao-vu/dot/${round.id}`}
                            aria-label={`Mở chi tiết ${round.name}`}
                          >
                            <ChevronRight size={18} aria-hidden="true" />
                          </Link>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {visible.length === 0 && (
                <div className="rnd-empty">
                  {allRounds.length === 0
                    ? 'Chưa có đợt nào. Bấm “Tạo đợt mới” để bắt đầu.'
                    : 'Không có đợt nào khớp bộ lọc.'}
                </div>
              )}
            </div>
          </div>
          <nav className="rnd-pager" aria-label="Phân trang">
            <span>
              {rounds.length > 0
                ? `Hiển thị ${firstIndex + 1}–${Math.min(
                    currentPage * PAGE_SIZE,
                    rounds.length,
                  )} trên ${rounds.length} đợt`
                : 'Không có đợt'}
            </span>
            <span className="rnd-pager-controls">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="rnd-pager-page">
                Trang {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </span>
          </nav>
        </div>
      )}

      <p className="rnd-foot">
        Đợt Nháp chỉ giáo vụ thấy; bấm Mở đợt (ở danh sách hoặc trang chi tiết)
        để gửi thông báo cho giảng viên và sinh viên có tên. Khi mọi đề tài đã
        công bố kết quả, bấm Kết thúc đợt ở trang chi tiết; đợt Đã kết thúc chỉ
        xem, không sửa mốc hay danh sách.
      </p>

      {creating && (
        <CreateRoundDialog
          roundService={roundService}
          rounds={allRounds}
          initialCopyFromId={creating.copyFromId}
          onClose={closeCreate}
          onCreated={(created) => {
            setCreating(null);
            toast.success(
              `Đã tạo đợt Nháp ${created.name}. Bấm vào đợt để cấu hình mốc và thêm giảng viên, sinh viên.`,
            );
            // Đợt mới là Nháp: chuyển bộ lọc để thấy ngay đợt vừa tạo.
            setStatus('Nháp');
            setProgram('');
            setPage(1);
            reloadList();
          }}
        />
      )}

      {dialog && dialogRound && (
        <RoundLifecycleDialog
          kind={dialog.kind}
          round={dialogRound}
          roundService={roundService}
          onClose={closeDialog}
          onDone={(kind) => {
            setDialog(null);
            if (kind === 'open') {
              // Đợt vừa mở chuyển sang Đang diễn ra: đưa bộ lọc theo (như artboard).
              setStatus('Đang diễn ra');
              setPage(1);
            }
            reloadList();
          }}
        />
      )}
    </div>
  );
};
