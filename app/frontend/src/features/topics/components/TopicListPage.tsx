'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
  'Không đủ điều kiện công bố',
  'Không có nhóm',
  'Bị từ chối',
];

const INTRO =
  'Danh sách đề tài của đợt. Đóng & công bố danh sách và xuất Excel làm ở Chi tiết đợt, tab Đề tài.';

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// Màn Đề tài của Giáo vụ (docs/DESIGN/03, artboard GiaoVu-DeTai): danh sách đề
// tài của một đợt kèm bộ lọc. Đóng & công bố danh sách và xuất Excel làm ở
// Chi tiết đợt, tab Đề tài. Đợt đang xem giữ trong URL (?dot=id); mặc định là
// đợt đang diễn ra đầu tiên.
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

  const resetFilters = () => {
    setSupervisorId('');
    setStatus('Tất cả');
    setSearch('');
    setPage(1);
  };

  const onFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
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
            <h1>Đề tài</h1>
            <p>{INTRO}</p>
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
  const items = current?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const filtered = supervisorId !== '' || status !== 'Tất cả' || search !== '';
  const roundEmpty = current?.roundTotal === 0;
  const selected = rounds.find((r) => r.id === roundId);
  const publishedAt = selected?.topicsPublishedAt ?? null;
  const publishLine =
    publishedAt !== null
      ? `Danh sách đề tài đã công bố cho sinh viên ngày ${formatDate(publishedAt.slice(0, 10))}.`
      : selected?.status === 'Nháp'
        ? 'Đợt đang Nháp nên chưa công bố danh sách đề tài.'
        : 'Danh sách đề tài chưa công bố cho sinh viên.';

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
          <h1>Đề tài</h1>
          <p>{INTRO}</p>
        </div>
      </div>

      {selected && (
        <p className="tpc-publish-line" role="status">
          {publishLine}{' '}
          <Link
            href={`/giao-vu/dot/${encodeURIComponent(selected.id)}?tab=de-tai`}
          >
            Mở tab Đề tài của đợt
          </Link>
        </p>
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
    </div>
  );
};
