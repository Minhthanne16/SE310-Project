'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiRequest } from '@/api/request';
import { formatDateTime } from '@/features/rounds/roundUtils';
import { roundService } from '@/features/rounds/services/roundService';
import { exportFileName } from '@/features/topics/topicExport';
import { downloadXlsx } from '@/lib/xlsx';
import type { Round } from '@/types/round';
import {
  STAGES,
  filterStatistics,
  registrationStatisticsTable,
  topicStatisticsTable,
  type RoundStatistics,
  type StatisticsFilters,
} from './statisticsData';
import './statistics.css';

const initialFilters: StatisticsFilters = {
  status: '',
  search: '',
  supervisorId: '',
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';

export function StatisticsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState('');
  const [data, setData] = useState<RoundStatistics | null>(null);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    roundService
      .list()
      .then((items) => {
        if (!active) return;
        setRounds(items);
        setRoundId((id) => id || items[0]?.id || '');
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoadingRounds(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!roundId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    apiRequest<RoundStatistics>(`/statistics/${encodeURIComponent(roundId)}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roundId, revision]);

  const rows = useMemo(
    () => filterStatistics(data?.items ?? [], filters),
    [data, filters],
  );
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const row of data?.items ?? [])
      result.set(row.topic.status, (result.get(row.topic.status) ?? 0) + 1);
    return [...result].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const totals = data?.items.length ?? 0;
  const withGroup =
    data?.items.filter((item) => item.topic.group.length > 0).length ?? 0;
  const round = rounds.find((item) => item.id === roundId);
  const showEmpty = !loading && data && totals === 0;

  const changeRound = (id: string) => {
    setRoundId(id);
    setFilters(initialFilters);
  };
  const exportExcel = async (kind: 'topics' | 'registrations') => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const table =
        kind === 'topics'
          ? topicStatisticsTable(rows)
          : registrationStatisticsTable(data);
      await downloadXlsx(exportFileName(kind, data.roundName), table);
      toast.success(
        `Đã xuất ${kind === 'topics' ? rows.length + ' đề tài theo bộ lọc' : data.students.length + ' sinh viên toàn đợt'}.`,
      );
    } catch (reason: unknown) {
      toast.error(errorMessage(reason));
    } finally {
      setExporting(false);
    }
  };
  const exportCsv = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.supervisorId)
        params.set('supervisorId', filters.supervisorId);
      if (filters.search.trim()) params.set('search', filters.search.trim());
      const response = await fetch(
        `/api/statistics/${encodeURIComponent(data.roundId)}/topics.csv?${params}`,
        { cache: 'no-store' },
      );
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? 'Bạn không có quyền xuất danh sách.'
            : 'Không xuất được CSV.',
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `danh-sach-de-tai-${data.roundId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(`Đã xuất CSV gồm ${rows.length} đề tài theo bộ lọc.`);
    } catch (reason: unknown) {
      toast.error(errorMessage(reason));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="statistics-page">
      <div className="statistics-heading">
        <div className="app-page-heading">
          <h1>Thống kê</h1>
          <p>
            Theo dõi đề tài, tiến độ khóa luận và tải giảng viên theo từng đợt.
          </p>
        </div>
        <div className="statistics-round">
          <label htmlFor="statistics-round">Đợt khóa luận</label>
          <select
            id="statistics-round"
            className="app-select"
            value={roundId}
            onChange={(event) => changeRound(event.target.value)}
            disabled={loadingRounds || rounds.length === 0}
          >
            {rounds.length === 0 && <option value="">Chưa có đợt</option>}
            {rounds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.periodLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="statistics-notice statistics-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="app-button"
            onClick={() => setRevision((n) => n + 1)}
          >
            Thử lại
          </button>
        </div>
      )}
      {(loadingRounds || loading) && (
        <div className="app-card" role="status">
          <span>Đang tổng hợp dữ liệu của đợt...</span>
        </div>
      )}
      {!loading && !loadingRounds && rounds.length === 0 && !error && (
        <div className="app-card app-empty">
          <h2>Chưa có đợt khóa luận</h2>
          <p>Hãy tạo một đợt để bắt đầu theo dõi thống kê.</p>
        </div>
      )}

      {data && !loading && (
        <>
          <section className="statistics-overview" aria-label="Tổng quan đợt">
            <div className="statistics-overview-title">
              <span className="statistics-eyebrow">
                <BarChart3 size={16} aria-hidden="true" /> TỔNG QUAN ĐỢT
              </span>
              <h2>{data.roundName}</h2>
              <p>
                <span className="app-chip app-chip-info">
                  {round?.status ?? data.roundStatus}
                </span>
                <span> Dữ liệu tại {formatDateTime(data.snapshotAt)}</span>
              </p>
            </div>
            <div className="statistics-kpis">
              <div>
                <strong>{totals}</strong>
                <span>Đề tài</span>
              </div>
              <div>
                <strong>{withGroup}</strong>
                <span>Đã có nhóm</span>
              </div>
              <div>
                <strong>{data.students.length}</strong>
                <span>Sinh viên trong đợt</span>
              </div>
              <div>
                <strong>{data.loads.length}</strong>
                <span>Giảng viên</span>
              </div>
            </div>
          </section>

          {showEmpty && (
            <section className="statistics-notice" role="note">
              <strong>
                {data.roundStatus === 'Nháp'
                  ? 'Đợt đang chuẩn bị'
                  : 'Chưa có dữ liệu đề tài'}
              </strong>
              <p>
                Đợt này chưa có đề tài. Bảng và biểu đồ hiển thị số 0; danh sách
                sinh viên/giảng viên vẫn lấy từ đợt đã chọn.
              </p>
            </section>
          )}

          <div className="statistics-grid">
            <section className="app-card" aria-labelledby="status-title">
              <div className="app-card-header">
                <h2 id="status-title">Đề tài theo trạng thái</h2>
                <span className="statistics-caption">{totals} đề tài</span>
              </div>
              {counts.length ? (
                <div className="statistics-status-list">
                  {counts.map(([status, count]) => (
                    <button
                      type="button"
                      key={status}
                      className={`statistics-status-row ${filters.status === status ? 'statistics-status-selected' : ''}`}
                      aria-pressed={filters.status === status}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          status: prev.status === status ? '' : status,
                        }))
                      }
                    >
                      <span>{status}</span>
                      <progress
                        max={totals}
                        value={count}
                        aria-label={`${status}: ${count} / ${totals}`}
                      />
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="app-muted">Chưa có đề tài để phân loại.</p>
              )}
            </section>

            <section className="app-card" aria-labelledby="stages-title">
              <div className="app-card-header">
                <h2 id="stages-title">Đề tài theo 6 chặng</h2>
                <span className="statistics-caption">
                  Hoàn thành / Tổng đề tài
                </span>
              </div>
              <div className="statistics-stage-list">
                {STAGES.map((stage, index) => {
                  const count = data.items.filter(
                    (item) => item.stages[index],
                  ).length;
                  return (
                    <div className="statistics-stage-row" key={stage}>
                      <div className="statistics-stage-head">
                        <span>
                          {String(index + 1).padStart(2, '0')} · {stage}
                        </span>
                        <strong>
                          {count} / {totals}
                        </strong>
                      </div>
                      <progress
                        max={totals || 1}
                        value={count}
                        aria-label={`${stage}: ${count} / ${totals} đề tài`}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="statistics-grid">
            <section className="app-card" aria-labelledby="load-title">
              <div className="app-card-header">
                <h2 id="load-title">Tải giảng viên hướng dẫn</h2>
                <span className="statistics-caption">Đề tài / GV</span>
              </div>
              {data.loads.length ? (
                <div className="app-table-scroll">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Giảng viên</th>
                        <th>Số đề tài</th>
                        <th>Định mức</th>
                        <th>Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.loads.map((load) => (
                        <tr key={load.lecturerId}>
                          <td>
                            <strong>
                              {load.lecturerName ||
                                load.lecturerCode ||
                                'Giảng viên'}
                            </strong>
                            <div className="statistics-caption">
                              {load.lecturerCode}
                            </div>
                          </td>
                          <td>{load.count}</td>
                          <td>
                            {load.min}–{load.max}
                          </td>
                          <td>
                            <span
                              className={`app-chip ${load.level === 'over' ? 'app-chip-error' : load.level === 'below' ? 'app-chip-pending' : 'app-chip-active'}`}
                            >
                              {load.level === 'over'
                                ? 'Vượt mức'
                                : load.level === 'below'
                                  ? 'Dưới mức'
                                  : 'Trong mức'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="app-muted">
                  Chưa phân công giảng viên trong đợt.
                </p>
              )}
            </section>
            <section className="app-card" aria-labelledby="grades-title">
              <div className="app-card-header">
                <h2 id="grades-title">Phân bố điểm khóa luận</h2>
                <span className="app-chip app-chip-pending">Chưa khả dụng</span>
              </div>
              <div className="statistics-grade-empty" role="note">
                <FileSpreadsheet size={34} aria-hidden="true" />
                <strong>Đang chờ dữ liệu chấm điểm CP07</strong>
                <p>
                  Chưa có phiếu chấm và kết quả xác nhận/công bố được lưu trong
                  hệ thống. Sẽ chỉ thống kê điểm từ kết quả hợp lệ khi chức năng
                  chấm điểm hoàn thiện.
                </p>
                <button
                  type="button"
                  className="app-button"
                  disabled
                  aria-label="Xuất bảng điểm (chưa có dữ liệu được xác nhận)"
                >
                  Xuất bảng điểm · Chưa khả dụng
                </button>
              </div>
            </section>
          </div>

          <section className="app-card" aria-labelledby="detail-title">
            <div className="app-card-header statistics-detail-heading">
              <div>
                <h2 id="detail-title">Danh sách đề tài chi tiết</h2>
                <p className="app-muted">
                  Dữ liệu đối chiếu với biểu đồ; xuất đề tài theo bộ lọc đang
                  chọn.
                </p>
              </div>
              <div className="statistics-actions">
                <button
                  type="button"
                  className="app-button"
                  onClick={() => setRevision((n) => n + 1)}
                >
                  <RefreshCw size={16} aria-hidden="true" /> Làm mới
                </button>
                <button
                  type="button"
                  className="app-button"
                  disabled={exporting || totals === 0}
                  onClick={() => void exportCsv()}
                >
                  <Download size={16} aria-hidden="true" /> CSV
                </button>
                <button
                  type="button"
                  className="app-button app-button-primary"
                  disabled={exporting || totals === 0}
                  onClick={() => void exportExcel('topics')}
                >
                  <FileSpreadsheet size={16} aria-hidden="true" /> Excel đề tài
                </button>
                <button
                  type="button"
                  className="app-button"
                  disabled={exporting || data.students.length === 0}
                  onClick={() => void exportExcel('registrations')}
                >
                  <Download size={16} aria-hidden="true" /> Excel đăng ký · toàn
                  đợt
                </button>
              </div>
            </div>
            <div className="statistics-filters">
              <label className="statistics-search">
                <Search size={17} aria-hidden="true" />
                <span className="app-visually-hidden">Tìm đề tài</span>
                <input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Mã, tên đề tài, giảng viên, sinh viên..."
                />
              </label>
              <label>
                <span className="app-visually-hidden">Lọc trạng thái</span>
                <select
                  className="app-select"
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Mọi trạng thái</option>
                  {counts.map(([status, count]) => (
                    <option key={status} value={status}>
                      {status} ({count})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="app-visually-hidden">Lọc giảng viên</span>
                <select
                  className="app-select"
                  value={filters.supervisorId}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      supervisorId: event.target.value,
                    }))
                  }
                >
                  <option value="">Mọi giảng viên</option>
                  {data.loads.map((load) => (
                    <option key={load.lecturerId} value={load.lecturerId}>
                      {load.lecturerName || load.lecturerCode}
                    </option>
                  ))}
                </select>
              </label>
              <span className="statistics-caption" role="status">
                Hiển thị {rows.length}/{totals} đề tài
              </span>
            </div>
            {rows.length ? (
              <div className="app-table-scroll">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Đề tài</th>
                      <th>GV hướng dẫn</th>
                      <th>Nhóm</th>
                      <th>Tiến độ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ topic, progress }) => (
                      <tr key={topic.id}>
                        <td>
                          <Link
                            href={`/de-tai/${topic.id}`}
                            className="statistics-link"
                          >
                            {topic.code}
                          </Link>
                        </td>
                        <td>
                          <strong>{topic.title}</strong>
                          <div className="statistics-caption">
                            {topic.field} · {topic.source}
                          </div>
                        </td>
                        <td>{topic.supervisor.name}</td>
                        <td>
                          {topic.group.length
                            ? topic.group.map((m) => m.code).join(' · ')
                            : '—'}
                        </td>
                        <td>{progress}</td>
                        <td>
                          <span className="app-chip app-chip-info">
                            {topic.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="app-empty" role="status">
                {totals === 0
                  ? 'Đợt này chưa có đề tài.'
                  : 'Không có đề tài nào phù hợp với bộ lọc.'}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
