'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download, Search } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  TopicSourceChip,
  TopicStatusChip,
} from '@/features/topics/components/TopicChips';
import {
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import { groupLabel, thesisProgress } from '@/features/topics/topicUtils';
import { downloadCsv } from '@/lib/csv';
import { useUrlParam } from '@/lib/useUrlParam';
import type { Round } from '@/types/round';
import {
  TOPIC_STATUSES,
  type TopicFilters,
  type TopicList,
  type TopicPerson,
  type TopicStatus,
} from '@/types/topic';

interface TopicListPageProps {
  topicService?: TopicService;
  roundService?: RoundService;
}

const PAGE_SIZE = 10;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// Màn Quản lý đề tài của Giáo vụ (docs/DESIGN/03): danh sách đề tài của một
// đợt, lọc, xuất CSV và "Đóng & công bố danh sách". Đợt đang xem giữ trong URL
// (?dot=id); mặc định là đợt đang diễn ra đầu tiên.
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
  const [exportNote, setExportNote] = useState<string | null>(null);
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
    setExportNote(null);
  };

  const onFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
    setExportNote(null);
  };

  const closePublish = useCallback(() => {
    setPublishing(false);
    setPublishError(null);
  }, []);

  const publish = async () => {
    if (!roundId) return;
    setPublishBusy(true);
    setPublishError(null);
    try {
      await topicService.publish(roundId);
      setPublishing(false);
      toast.success('Đã công bố danh sách đề tài.');
      setReload((n) => n + 1);
    } catch (err: unknown) {
      setPublishError(errorMessage(err, 'Không công bố được danh sách.'));
    } finally {
      setPublishBusy(false);
    }
  };

  const exportList = async () => {
    if (!roundId) return;
    setExportNote(null);
    try {
      const result = await topicService.exportCsv({
        roundId,
        supervisorId,
        status,
        search,
      });
      if (result.count === 0) {
        setExportNote('Danh sách đang trống nên không có gì để xuất.');
        return;
      }
      downloadCsv('danh-sach-de-tai.csv', result.csv);
      toast.success(`Đã xuất ${result.count} đề tài.`);
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

  const heading = (
    <div className="app-page-heading">
      <h1>Quản lý đề tài</h1>
      <p>Danh sách đề tài của đợt; công bố danh sách sau hạn gửi đề tài.</p>
    </div>
  );

  if (rounds.length === 0 || !roundId)
    return (
      <>
        {heading}
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Tạo đợt khóa luận trước khi quản lý đề tài.</p>
          <Link className="status-state-action" href="/giao-vu/dot">
            Đến danh sách đợt
          </Link>
        </section>
      </>
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
  const blockedId = 'topic-publish-reason';

  return (
    <>
      {heading}

      <div className="app-toolbar">
        <div
          className="app-filters"
          role="search"
          aria-label="Lọc đợt, giảng viên hướng dẫn, trạng thái, tìm kiếm"
        >
          <select
            className="app-select"
            aria-label="Chọn đợt"
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
          <select
            className="app-select"
            aria-label="Lọc theo GVHD"
            value={supervisorId}
            onChange={(e) =>
              onFilterChange(() => setSupervisorId(e.target.value))
            }
          >
            <option value="">Tất cả GVHD</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="app-select"
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) =>
              onFilterChange(() =>
                setStatus(e.target.value as TopicStatus | 'Tất cả'),
              )
            }
          >
            <option value="Tất cả">Tất cả trạng thái</option>
            {TOPIC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="app-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm kiếm"
              placeholder="Tìm theo mã hoặc tên đề tài"
              value={search}
              onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
            />
          </div>
        </div>
        <div className="app-toolbar-actions">
          <button
            type="button"
            className="app-button"
            onClick={() => void exportList()}
          >
            <Download size={16} aria-hidden="true" />
            Xuất danh sách
          </button>
          <button
            type="button"
            className="app-button app-button-primary"
            aria-haspopup="dialog"
            disabled={!round?.canPublish}
            aria-describedby={round?.canPublish ? undefined : blockedId}
            onClick={() => setPublishing(true)}
          >
            Đóng &amp; công bố danh sách
          </button>
        </div>
      </div>

      {round && (
        <div
          className={`topic-banner${published ? ' topic-banner-published' : ''}`}
        >
          <span>
            <strong>{round.phase}</strong>
            {published
              ? '. Giảng viên không thêm hoặc xóa đề tài nữa.'
              : round.roundStatus === 'Đang diễn ra'
                ? '. Giảng viên còn thêm, sửa, xóa đề tài.'
                : `. Đợt ${round.roundStatus.toLowerCase()}.`}
          </span>
          <span>
            Hạn gửi đề tài: {formatDate(round.submissionDeadline)}
            {round.submissionDeadline
              ? ` · ${round.deadlinePassed ? 'Đã hết hạn gửi đề tài' : 'Chưa hết hạn gửi đề tài'}`
              : ''}
          </span>
        </div>
      )}
      {round && !round.canPublish && round.publishBlockedReason && (
        <p id={blockedId} className="app-muted">
          Chưa công bố được: {round.publishBlockedReason}
        </p>
      )}
      {exportNote && (
        <p role="status" className="app-muted">
          {exportNote}
        </p>
      )}

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
      ) : current.roundTotal === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đề tài</h2>
          <p>
            Đợt này chưa có đề tài nào. Giảng viên gửi đề tài trong hạn gửi đề
            tài.
          </p>
        </section>
      ) : items.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Lọc không có kết quả</h2>
          <p>Không có đề tài nào khớp bộ lọc hiện tại.</p>
          <button type="button" className="app-button" onClick={resetFilters}>
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        <>
          <div className="app-table-scroll" aria-busy={loading}>
            <table className="app-table app-topic-table">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Tên đề tài</th>
                  <th scope="col">GVHD</th>
                  <th scope="col">Nhóm</th>
                  <th scope="col">Nguồn</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Khóa luận</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((topic) => {
                  const load = current?.loads[topic.supervisor.id];
                  return (
                    <tr key={topic.id}>
                      <td>{topic.code}</td>
                      <td>
                        <Link
                          className="app-link"
                          href={`/giao-vu/de-tai/${topic.id}`}
                        >
                          {topic.title}
                        </Link>
                      </td>
                      <td>
                        <div className="topic-supervisor">
                          <span>{topic.supervisor.name}</span>
                          {load?.level === 'over' && (
                            <span className="app-chip app-chip-pending">
                              GV vượt mức
                              <span className="app-visually-hidden">
                                : {load.count}/{load.max} đề tài
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{groupLabel(topic)}</td>
                      <td>
                        <TopicSourceChip source={topic.source} />
                      </td>
                      <td>
                        <TopicStatusChip status={topic.status} />
                      </td>
                      <td>{thesisProgress(topic)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="app-pagination" aria-label="Phân trang">
            <span className="app-muted">
              {items.length} đề tài · Trang {currentPage}/{pageCount}
            </span>
            <div className="app-toolbar-actions">
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </div>
          </nav>
        </>
      )}

      {publishing && (
        <ConfirmDialog
          title="Đóng & công bố danh sách?"
          description="Sau khi công bố, giảng viên không thêm hoặc xóa đề tài được nữa; chỉ sửa được mô tả và yêu cầu của đề tài chưa có nhóm, và Lĩnh vực bị khóa. Không hoàn tác được."
          cancelLabel="Hủy"
          confirmLabel="Công bố danh sách"
          busy={publishBusy}
          error={publishError}
          onCancel={closePublish}
          onConfirm={() => void publish()}
        />
      )}
    </>
  );
};
