'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { StatusState } from '@/components/ui/StatusState';
import { formatDateTime } from '@/features/rounds/roundUtils';
import {
  TopicSourceChip,
  TopicStatusChip,
} from '@/features/topics/components/TopicChips';
import {
  TopicNotFoundError,
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import { formatScore, totalScore } from '@/features/topics/topicUtils';
import { useUrlParam } from '@/lib/useUrlParam';
import {
  HISTORY_CATEGORIES,
  SCORE_ROLES,
  type HistoryCategory,
  type Topic,
} from '@/types/topic';

interface TopicDetailPageProps {
  topicId: string;
  topicService?: TopicService;
}

type TopicTab = 'tong-quan' | 'bao-cao' | 'diem' | 'lich-su';

const TABS: { id: TopicTab; label: string }[] = [
  { id: 'tong-quan', label: 'Tổng quan' },
  { id: 'bao-cao', label: 'Báo cáo' },
  { id: 'diem', label: 'Điểm' },
  { id: 'lich-su', label: 'Lịch sử' },
];

const isTab = (value: string | null): value is TopicTab =>
  TABS.some((t) => t.id === value);

const BACK_HREF = '/giao-vu/de-tai';

const ROLE_LABEL: Record<(typeof SCORE_ROLES)[number], string> = {
  CTHĐ: 'Chủ tịch HĐ',
  TKHĐ: 'Thư ký HĐ',
  CBHD: 'GV hướng dẫn',
  CBPB: 'GV phản biện',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

// Màn Chi tiết đề tài của Giáo vụ (docs/DESIGN/03): chỉ xem, bốn tab Tổng quan,
// Báo cáo, Điểm, Lịch sử.
export const TopicDetailPage: React.FC<TopicDetailPageProps> = ({
  topicId,
  topicService = defaultTopicService,
}) => {
  const [tabParam, setTabParam] = useUrlParam('tab');
  const tab: TopicTab = isTab(tabParam) ? tabParam : 'tong-quan';
  const [topic, setTopic] = useState<Topic | null>(null);
  const [roundName, setRoundName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<HistoryCategory | 'Tất cả'>(
    'Tất cả',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const found = await topicService.get(topicId);
      setTopic(found);
      // Tên đợt lấy từ trạng thái đợt; lỗi ở đây không chặn xem đề tài.
      topicService
        .roundState(found.roundId)
        .then((r) => setRoundName(r.roundName))
        .catch(() => setRoundName(''));
    } catch (err: unknown) {
      if (err instanceof TopicNotFoundError) setNotFound(true);
      else
        setLoadError(
          err instanceof Error && err.message
            ? err.message
            : 'Không tải được đề tài.',
        );
    } finally {
      setLoading(false);
    }
  }, [topicService, topicId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài...
      </p>
    );

  if (notFound)
    return (
      <StatusState
        variant="notFound"
        title="Không tìm thấy đề tài"
        description="Đề tài không tồn tại hoặc đã bị xóa."
        action={{ href: BACK_HREF, label: '← Về danh sách đề tài' }}
      />
    );

  if (loadError || !topic)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
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

  const history =
    category === 'Tất cả'
      ? topic.history
      : topic.history.filter((h) => h.category === category);

  return (
    <>
      <Link
        className="app-back-link"
        href={`${BACK_HREF}?dot=${topic.roundId}`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Tất cả đề tài
      </Link>

      <div className="app-page-heading">
        <p className="app-muted">{topic.code}</p>
        <h1>{topic.title}</h1>
        <div className="app-chip-row">
          <TopicStatusChip status={topic.status} />
          <TopicSourceChip source={topic.source} />
          <Link
            className="app-link"
            href={`/giao-vu/de-tai?dot=${topic.roundId}`}
          >
            {roundName || 'Xem đợt'}
          </Link>
        </div>
      </div>

      <div className="app-segmented" role="group" aria-label="Nội dung đề tài">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTabParam(t.id, 'replace')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tong-quan' && (
        <section className="app-card" aria-labelledby="topic-overview-title">
          <div className="app-card-header">
            <h2 id="topic-overview-title">Tổng quan</h2>
          </div>
          <dl className="topic-fields">
            <Field label="Mô tả">{topic.description}</Field>
            <Field label="Yêu cầu">{topic.requirements}</Field>
            <Field label="Lĩnh vực">{topic.field}</Field>
            <Field label="GVHD">{topic.supervisor.name}</Field>
            <Field label="GVPB">
              {topic.reviewer?.name ?? 'Chưa phân công'}
            </Field>
            <Field label="Hội đồng">{topic.council ?? 'Chưa phân công'}</Field>
            <Field label="Nhóm">
              {topic.group.length === 0 ? (
                'Chưa có nhóm'
              ) : (
                <ul>
                  {topic.group.map((m) => (
                    <li key={m.id}>
                      {m.name} ({m.code})
                      {m.representative && (
                        <>
                          {' '}
                          <span className="app-chip app-chip-info">
                            Đại diện
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </dl>
        </section>
      )}

      {tab === 'bao-cao' && (
        <section className="app-card" aria-labelledby="topic-reports-title">
          <div className="app-card-header">
            <h2 id="topic-reports-title">Báo cáo</h2>
          </div>
          {topic.submissions.length === 0 ? (
            <p className="app-muted">Nhóm chưa nộp bài nào.</p>
          ) : (
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th scope="col">Phiên bản</th>
                    <th scope="col">Loại</th>
                    <th scope="col">Tệp</th>
                    <th scope="col">Người nộp</th>
                    <th scope="col">Thời điểm</th>
                    <th scope="col">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {[...topic.submissions].reverse().map((s) => (
                    <tr key={s.versionNo}>
                      <td>v{s.versionNo}</td>
                      <td>{s.kind}</td>
                      <td>{s.fileName}</td>
                      <td>{s.submittedBy}</td>
                      <td>{formatDateTime(s.submittedAt)}</td>
                      <td>
                        {s.late && (
                          <span className="app-chip app-chip-pending">
                            Nộp trễ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'diem' && (
        <section className="app-card" aria-labelledby="topic-scores-title">
          <div className="app-card-header">
            <h2 id="topic-scores-title">Điểm</h2>
          </div>
          {topic.scores.length === 0 ? (
            <p className="app-muted">Chưa có phiếu điểm nào.</p>
          ) : (
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th scope="col">Sinh viên</th>
                    {SCORE_ROLES.map((r) => (
                      <th key={r} scope="col" title={ROLE_LABEL[r]}>
                        {r}
                      </th>
                    ))}
                    <th scope="col">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {topic.scores.map((s) => {
                    const total = totalScore(s.scores);
                    return (
                      <tr key={s.studentId}>
                        <td>
                          {s.name} ({s.code})
                        </td>
                        {SCORE_ROLES.map((r) => (
                          <td key={r}>{formatScore(s.scores[r])}</td>
                        ))}
                        <td>
                          {total === null ? (
                            <span className="app-chip app-chip-pending">
                              Chưa đủ điểm
                            </span>
                          ) : (
                            <strong>{formatScore(total)}</strong>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="app-muted">
            Tổng = (CTHĐ + TKHĐ + 2 × CBHD + 2 × CBPB) / 6, thang 10, làm tròn
            hai chữ số; chỉ tính khi đủ bốn phiếu.
          </p>
        </section>
      )}

      {tab === 'lich-su' && (
        <section className="app-card" aria-labelledby="topic-history-title">
          <div className="app-card-header">
            <h2 id="topic-history-title">Lịch sử</h2>
            <select
              className="app-select"
              aria-label="Lọc lịch sử"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as HistoryCategory | 'Tất cả')
              }
            >
              <option value="Tất cả">Tất cả</option>
              {HISTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {topic.history.length === 0 ? (
            <p className="app-muted">Lịch sử trống</p>
          ) : history.length === 0 ? (
            <p className="app-muted">Không có mục nào thuộc “{category}”.</p>
          ) : (
            <ol className="topic-timeline" aria-label="Lịch sử đề tài">
              {history.map((h) => (
                <li key={h.id}>
                  <time dateTime={h.at}>{formatDateTime(h.at)}</time>
                  <span>
                    <strong>{h.action}</strong> ·{' '}
                    <span className="app-chip">{h.category}</span> · {h.actor}
                  </span>
                  {h.detail && <span className="app-muted">{h.detail}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
};
