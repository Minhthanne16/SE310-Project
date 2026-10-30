'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Search,
} from 'lucide-react';
import '@/features/topics/topics.css';
import { formatDate } from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import {
  avatarInitials,
  shortName,
  thesisCell,
} from '@/features/topics/topicUtils';
import { downloadCsv } from '@/lib/csv';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { useUrlParam } from '@/lib/useUrlParam';
import type { Round } from '@/types/round';
import type {
  TopicFilters,
  TopicList,
  TopicPerson,
  TopicStatus,
} from '@/types/topic';

interface TopicListPageProps {
  topicService?: TopicService;
  roundService?: RoundService;
}

const PAGE_SIZE = 8;

// Thứ tự nút lọc theo artboard GiaoVu-DeTai.
const STATUS_FILTERS: (TopicStatus | 'Tất cả')[] = [
  'Tất cả',
  'Chưa đăng ký',
  'Chờ GV duyệt',
  'Đã đăng ký',
  'Đang thực hiện',
  'Đã cho điểm',
  'Đã hoàn tất',
  'Bị từ chối',
];

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

interface PublishDialogProps {
  belowMin: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const PublishDialog: React.FC<PublishDialogProps> = ({
  belowMin,
  busy,
  error,
  onCancel,
  onConfirm,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>({
    initialFocusRef: cancelRef,
  });
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="tpc-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpc-pub-title"
        aria-describedby="tpc-pub-desc"
        className="tpc-dialog"
      >
        <h2 id="tpc-pub-title">Đóng và công bố danh sách đề tài?</h2>
        <p id="tpc-pub-desc">
          Giảng viên không gửi thêm hay xóa đề tài được nữa; chỉ sửa được mô tả
          và yêu cầu của đề tài chưa có nhóm, và Lĩnh vực bị khóa. Sinh viên
          trong đợt nhận thông báo và bắt đầu đăng ký theo mốc &quot;Công bố đề
          tài · SV đăng ký&quot;. Không hoàn tác được.
        </p>
        {belowMin > 0 && (
          <p className="tpc-dialog-warn">
            {belowMin} giảng viên chưa đạt số đề tài tối thiểu. Vẫn công bố
            được; đây chỉ là cảnh báo.
          </p>
        )}
        {error && (
          <p role="alert" className="tpc-dialog-err">
            {error}
          </p>
        )}
        <div className="tpc-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="tpc-btn"
            onClick={onCancel}
            disabled={busy}
          >
            Để sau
          </button>
          <button
            type="button"
            className="tpc-btn tpc-btn-primary"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Đang xử lý...' : 'Đóng và công bố'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Màn Quản lý đề tài của Giáo vụ (docs/DESIGN/03, artboard GiaoVu-DeTai):
// danh sách đề tài của một đợt, lọc, xuất CSV và "Đóng & công bố danh sách".
// Đợt đang xem giữ trong URL (?dot=id); mặc định là đợt đang diễn ra đầu tiên.
export const TopicListPage: React.FC<TopicListPageProps> = ({
  topicService = defaultTopicService,
  roundService = defaultRoundService,
}) => {
  const [dotParam, setDotParam] = useUrlParam('dot');
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [data, setData] = useState<TopicList | null>(null);
  const [supervisors, setSupervisors] = useState<TopicPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [supervisorId, setSupervisorId] = useState('');
  const [status, setStatus] = useState<TopicStatus | 'Tất cả'>('Tất cả');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const [exported, setExported] = useState<number | null>(null);
  const [exportEmpty, setExportEmpty] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    roundService
      .list()
      .then(setRounds)
      .catch((err: unknown) =>
        setLoadError(errorMessage(err, 'Không tải được danh sách đợt.')),
      );
  }, [roundService]);

  const roundId =
    rounds === null
      ? null
      : rounds.some((r) => r.id === dotParam)
        ? dotParam
        : ((rounds.find((r) => r.status === 'Đang diễn ra') ?? rounds[0])?.id ??
          null);

  useEffect(() => {
    if (!roundId) return;
    let cancelled = false;
    setSupervisors([]);
    topicService
      .listSupervisors(roundId)
      .then((list) => {
        if (!cancelled) setSupervisors(list);
      })
      .catch(() => {
        if (!cancelled) setSupervisors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [topicService, roundId]);

  useEffect(() => {
    if (!roundId) return;
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    const filters: TopicFilters = { roundId, supervisorId, status, search };
    topicService
      .list(filters)
      .then((result) => {
        if (request === requestRef.current) setData(result);
      })
      .catch((err: unknown) => {
        if (request === requestRef.current)
          setLoadError(errorMessage(err, 'Không tải được danh sách đề tài.'));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [topicService, roundId, supervisorId, status, search, reload]);

  const clearNotes = () => {
    setExported(null);
    setExportEmpty(false);
  };

  const resetFilters = () => {
    setSupervisorId('');
    setStatus('Tất cả');
    setSearch('');
    setPage(1);
    clearNotes();
  };

  const onFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
    clearNotes();
  };

  const closePublish = () => {
    setPublishing(false);
    setPublishError(null);
  };

  const publish = async () => {
    if (!roundId) return;
    setPublishBusy(true);
    setPublishError(null);
    try {
      await topicService.publish(roundId);
      setPublishing(false);
      setJustPublished(true);
      setReload((n) => n + 1);
    } catch (err: unknown) {
      setPublishError(errorMessage(err, 'Không công bố được danh sách.'));
    } finally {
      setPublishBusy(false);
    }
  };

  const exportList = async () => {
    if (!roundId) return;
    clearNotes();
    try {
      const result = await topicService.exportCsv({
        roundId,
        supervisorId,
        status,
        search,
      });
      if (result.count === 0) {
        setExportEmpty(true);
        return;
      }
      downloadCsv('danh-sach-de-tai.csv', result.csv);
      setExported(result.count);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Không xuất được danh sách.'));
    }
  };

  if (rounds === null)
    return loadError ? (
      <section className="status-state" role="alert">
        <h2>Không tải được danh sách</h2>
        <p>{loadError}</p>
      </section>
    ) : (
      <p role="status" className="app-muted">
        Đang tải danh sách đề tài...
      </p>
    );

  if (rounds.length === 0 || !roundId)
    return (
      <div className="tpc-page">
        <div className="tpc-head">
          <div className="tpc-head-text">
            <h1>Quản lý đề tài</h1>
            <p>
              Danh sách đề tài của đợt; công bố danh sách sau hạn gửi đề tài.
            </p>
          </div>
        </div>
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Tạo đợt khóa luận trước khi quản lý đề tài.</p>
          <Link className="status-state-action" href="/giao-vu/dot">
            Đến danh sách đợt
          </Link>
        </section>
      </div>
    );

  // Dữ liệu của đợt khác (đang chuyển đợt) không được hiện lại.
  const current = data && data.round.roundId === roundId ? data : null;
  const round = current?.round;
  const items = current?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const published = round?.phase === 'Đã công bố danh sách';
  const waiting =
    !!round &&
    !published &&
    round.roundStatus === 'Đang diễn ra' &&
    round.submissionDeadline !== '' &&
    !round.deadlinePassed;
  const blocked = !!round && !round.canPublish && !published;
  const deadline = round ? formatDate(round.submissionDeadline) : '';
  const hasDeadline = !!round && round.submissionDeadline !== '';
  const belowMin = current
    ? Object.values(current.loads).filter((l) => l.level === 'below').length
    : 0;
  const filtered = supervisorId !== '' || status !== 'Tất cả' || search !== '';
  const roundEmpty = current?.roundTotal === 0;
  const blockedId = 'tpc-publish-why';

  const intro = !hasDeadline
    ? 'Danh sách đề tài của đợt; công bố danh sách sau hạn gửi đề tài.'
    : published
      ? `Danh sách đề tài của đợt đã được công bố cho sinh viên. Hạn gửi đề tài của giảng viên đã hết lúc 23:59 ngày ${deadline}.`
      : round?.deadlinePassed
        ? `Hạn gửi đề tài của giảng viên đã hết lúc 23:59 ngày ${deadline}. Đóng danh sách để công bố cho sinh viên.`
        : `Giảng viên đang gửi đề tài đến 23:59 ngày ${deadline}. Hết hạn này mới đóng danh sách để công bố cho sinh viên.`;

  const goPage = (n: number) => setPage(n);

  return (
    <div className="tpc-page">
      <div className="tpc-round-row">
        <label htmlFor="tpc-round">Đợt</label>
        <select
          id="tpc-round"
          className="tpc-select"
          value={roundId}
          onChange={(e) => {
            setDotParam(e.target.value, 'replace');
            setJustPublished(false);
            resetFilters();
          }}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tpc-head">
        <div className="tpc-head-text">
          <h1>Quản lý đề tài</h1>
          <p>{intro}</p>
        </div>
        <div className="tpc-actions">
          <button
            type="button"
            className="tpc-btn"
            onClick={() => void exportList()}
          >
            <Download size={16} aria-hidden="true" />
            Xuất danh sách
          </button>
          <button
            type="button"
            className="tpc-btn tpc-btn-primary"
            data-done={published}
            aria-haspopup="dialog"
            disabled={!round?.canPublish}
            title={
              waiting
                ? `Chưa hết hạn gửi đề tài của giảng viên (23:59 ngày ${deadline})`
                : undefined
            }
            aria-describedby={blocked ? blockedId : undefined}
            onClick={() => setPublishing(true)}
          >
            {published ? 'Đã công bố danh sách' : 'Đóng & công bố danh sách'}
          </button>
        </div>
      </div>

      {blocked && (
        <div id={blockedId} role="note" className="tpc-note">
          <Lock size={18} aria-hidden="true" />
          {waiting ? (
            <span>
              <b>Chưa đóng và công bố được.</b> Giảng viên còn được gửi đề tài
              đến 23:59 ngày {deadline}. Sau thời điểm này nút Đóng &amp; công
              bố danh sách sẽ mở.
            </span>
          ) : (
            <span>
              <b>Chưa đóng và công bố được.</b> {round?.publishBlockedReason}
            </span>
          )}
        </div>
      )}
      {exported !== null && (
        <div role="status" className="tpc-banner tpc-banner-ok">
          Đã tải tệp CSV danh sách đề tài ({exported} đề tài theo bộ lọc hiện
          tại).
        </div>
      )}
      {exportEmpty && (
        <div role="alert" className="tpc-banner tpc-banner-err">
          {roundEmpty
            ? 'Chưa có đề tài nào trong đợt nên không có gì để xuất.'
            : 'Danh sách đang trống theo bộ lọc hiện tại nên không có gì để xuất. Đổi hoặc xóa bộ lọc rồi thử lại.'}
        </div>
      )}
      {published && justPublished && (
        <div role="status" className="tpc-banner tpc-banner-done">
          <b>Đã công bố danh sách đề tài.</b> Sinh viên trong đợt đã nhận thông
          báo và có thể đăng ký.
        </div>
      )}

      <div className="tpc-filters" role="search" aria-label="Lọc đề tài">
        <div className="tpc-search">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="tpc-q" className="app-visually-hidden">
            Tìm đề tài
          </label>
          <input
            id="tpc-q"
            type="search"
            placeholder="Tìm theo mã, tên đề tài, sinh viên, giảng viên"
            value={search}
            onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
          />
        </div>
        <select
          className="tpc-select tpc-gv-select"
          aria-label="Lọc theo giảng viên hướng dẫn"
          value={supervisorId}
          onChange={(e) =>
            onFilterChange(() => setSupervisorId(e.target.value))
          }
        >
          <option value="">Tất cả GV hướng dẫn</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tpc-seg" role="group" aria-label="Lọc theo trạng thái">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => onFilterChange(() => setStatus(s))}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="tpc-hint">
        Bấm tên đề tài để xem chi tiết và lịch sử. Xác nhận và công bố kết quả ở
        trang <Link href="/giao-vu/ket-qua">Kết quả</Link>.
      </p>

      {loadError ? (
        <section className="status-state" role="alert">
          <h2>Không tải được danh sách</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className="app-button"
            onClick={() => setReload((n) => n + 1)}
          >
            Thử lại
          </button>
        </section>
      ) : !current ? (
        <p role="status" className="app-muted">
          Đang tải danh sách đề tài...
        </p>
      ) : (
        <div className="tpc-tablebox" aria-busy={loading}>
          <table className="tpc-table">
            <thead>
              <tr>
                <th scope="col">Đề tài</th>
                <th scope="col">GV hướng dẫn</th>
                <th scope="col">GV phản biện</th>
                <th scope="col">Hội đồng</th>
                <th scope="col">Khóa luận</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((topic) => {
                const load = current.loads[topic.supervisor.id];
                const kl = thesisCell(topic);
                return (
                  <tr key={topic.id}>
                    <td>
                      <div className="tpc-cell-title">
                        <Link href={`/giao-vu/de-tai/${topic.id}`}>
                          {topic.title}
                        </Link>
                        <span className="tpc-sub">
                          {topic.code} ·{' '}
                          {topic.group.length > 0
                            ? topic.group
                                .map((m) => shortName(m.name))
                                .join(', ')
                            : 'Chưa có nhóm'}
                          {topic.source === 'SV đề xuất' && ' · SV đề xuất'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="tpc-person">
                        <span className="tpc-avatar" aria-hidden="true">
                          {avatarInitials(topic.supervisor.name)}
                        </span>
                        {topic.supervisor.name}
                      </span>
                    </td>
                    <td
                      className={topic.reviewer ? undefined : 'tpc-warn-text'}
                    >
                      {topic.reviewer?.name ?? 'Chưa phân công'}
                    </td>
                    <td className={topic.council ? undefined : 'tpc-warn-text'}>
                      {topic.council ?? 'Chưa gán'}
                    </td>
                    <td>
                      <span
                        className={`tpc-kl tpc-kl-${kl.tone}`}
                        aria-label={`Khóa luận: ${kl.label}, ${kl.sub}`}
                      >
                        <span className="tpc-kl-label">
                          <span className="tpc-kl-dot" aria-hidden="true" />
                          {kl.label}
                        </span>
                        <span className="tpc-kl-sub">{kl.sub}</span>
                      </span>
                    </td>
                    <td>
                      <TopicStatusChip status={topic.status} />
                      {load?.level === 'over' && (
                        <span className="tpc-flag">
                          GV vượt mức {load.count}/{load.max}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="tpc-empty-cell">
                    <div className="tpc-empty">
                      <strong>
                        {roundEmpty
                          ? 'Chưa có đề tài nào trong đợt'
                          : 'Không có đề tài nào khớp bộ lọc'}
                      </strong>
                      <span>
                        {roundEmpty
                          ? 'Đề tài giảng viên gửi và đề tài sinh viên đề xuất được chấp nhận sẽ hiện ở đây.'
                          : 'Thử chọn trạng thái hoặc giảng viên hướng dẫn khác, hoặc xóa bộ lọc để xem toàn bộ danh sách.'}
                      </span>
                      {!roundEmpty && filtered && (
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          onClick={resetFilters}
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {items.length > 0 && (
            <div className="tpc-pager">
              <span>
                Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, items.length)} trên{' '}
                {items.length} đề tài
              </span>
              <nav aria-label="Phân trang">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={currentPage <= 1}
                  onClick={() => goPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === currentPage ? 'page' : undefined}
                    onClick={() => goPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={currentPage >= pageCount}
                  onClick={() => goPage(currentPage + 1)}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </nav>
            </div>
          )}
        </div>
      )}

      <p className="tpc-foot">
        Khóa luận: Chưa nộp, Đã nộp (kèm số phiên bản) hoặc Chốt bản cuối. Cờ
        cam là cảnh báo giảng viên nhận vượt hoặc chưa đạt số đề tài tối thiểu,
        tối đa của đợt; chỉ để theo dõi, không chặn đăng ký. Công bố kết quả
        đồng thời hoàn tất khóa luận (nhóm đã chốt bản cuối, hoặc hết hạn nộp
        thì lấy bản mới nhất).
      </p>

      {publishing && (
        <PublishDialog
          belowMin={belowMin}
          busy={publishBusy}
          error={publishError}
          onCancel={closePublish}
          onConfirm={() => void publish()}
        />
      )}
    </div>
  );
};
