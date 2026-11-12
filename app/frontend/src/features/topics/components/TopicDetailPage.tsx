'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusState } from '@/components/ui/StatusState';
import { SubmissionPanel } from '@/features/submissions/components/SubmissionPanel';
import '@/features/topics/topics.css';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  TopicNotFoundError,
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import {
  avatarInitials,
  dateOf,
  formatComponentScore,
  formatDefenseStart,
  formatScore,
  scoreDeviations,
  timeOf,
  totalScore,
} from '@/features/topics/topicUtils';
import { useUrlParam } from '@/lib/useUrlParam';
import {
  HISTORY_CATEGORIES,
  type HistoryCategory,
  type ScoreRole,
  type SubmissionKind,
  type Topic,
  type TopicSubmission,
} from '@/types/topic';

interface TopicDetailPageProps {
  topicId: string;
  topicService?: TopicService;
  // Đề tài thật (cùng cờ với đợt thật): tab Báo cáo đọc và tải tệp qua
  // /api/topics/{id}/submissions (PDR-056) thay cho dữ liệu mẫu.
  liveSubmissions?: boolean;
}

type TopicTab = 'tong-quan' | 'bao-cao' | 'diem' | 'lich-su';

const TABS: { id: TopicTab; label: string }[] = [
  { id: 'tong-quan', label: 'Tổng quan' },
  { id: 'bao-cao', label: 'Báo cáo và phiên bản' },
  { id: 'diem', label: 'Điểm' },
  { id: 'lich-su', label: 'Lịch sử' },
];

const isTab = (value: string | null): value is TopicTab =>
  TABS.some((t) => t.id === value);

const ROLE_SHORT: Record<ScoreRole, string> = {
  CTHĐ: 'CT',
  TKHĐ: 'TK',
  CBHD: 'HD',
  CBPB: 'PB',
};

const BACK_HREF = '/giao-vu/de-tai';

const CATEGORY_CLASS: Record<HistoryCategory, string> = {
  'Trạng thái': 'tpc-cat-status',
  'Nội dung': '',
  Nhóm: 'tpc-cat-group',
  'Bài nộp': '',
  'Phân công': 'tpc-cat-assign',
  Điểm: 'tpc-cat-score',
};

interface Step {
  name: string;
  sub: string;
  done: boolean;
}

const latestOf = (topic: Topic, kinds: SubmissionKind[]) => {
  const list = topic.submissions.filter((s) => kinds.includes(s.kind));
  return { count: list.length, last: list[list.length - 1] };
};

// Tiến độ 6 chặng suy ra từ nhóm, bài nộp, điểm và trạng thái của đề tài.
function progressSteps(topic: Topic): Step[] {
  const stage = (name: string, kinds: SubmissionKind[]): Step => {
    const { count, last } = latestOf(topic, kinds);
    return last
      ? {
          name,
          done: true,
          sub: `Nộp ${dateOf(last.submittedAt).slice(0, 5)} · ${count} phiên bản`,
        }
      : { name, done: false, sub: 'Chưa nộp' };
  };
  const graded =
    topic.scores.length > 0 &&
    topic.scores.every((s) => totalScore(s.scores) !== null);
  return [
    {
      name: 'Đăng ký',
      done: topic.group.length > 0,
      sub:
        topic.group.length > 0
          ? `${topic.group.length} sinh viên`
          : 'Chưa có nhóm',
    },
    stage('Đề cương', ['Đề cương']),
    stage('Giữa kỳ', ['Giữa kỳ']),
    stage('Cuối kỳ', ['Cuối kỳ', 'Bản khóa luận']),
    {
      name: 'Đánh giá',
      done: graded,
      sub: graded ? 'Đủ 4 điểm' : 'Chưa đủ điểm',
    },
    {
      name: 'Kết quả',
      done: topic.status === 'Đã hoàn tất',
      sub:
        topic.status === 'Đã hoàn tất'
          ? 'Đã hoàn tất'
          : topic.status === 'Đã xác nhận'
            ? 'Chờ công bố'
            : topic.status === 'Đã cho điểm'
              ? 'Chờ giáo vụ xác nhận'
              : topic.status === 'Có lệch điểm'
                ? 'Còn cặp điểm lệch'
                : 'Chưa có kết quả',
    },
  ];
}

interface DocGroup {
  title: string;
  kinds: SubmissionKind[];
}

const DOC_GROUPS: DocGroup[] = [
  { title: 'Đề cương', kinds: ['Đề cương'] },
  { title: 'Báo cáo giữa kỳ', kinds: ['Giữa kỳ'] },
  { title: 'Báo cáo cuối kỳ', kinds: ['Cuối kỳ'] },
  { title: 'Bản khóa luận', kinds: ['Bản khóa luận'] },
];

// Chip trạng thái ở đầu từng nhóm tài liệu.
function docStatus(
  topic: Topic,
  group: DocGroup & { versions: TopicSubmission[] },
): { text: string; className: string } {
  const count = group.versions.length;
  if (group.kinds[0] === 'Đề cương')
    return topic.outlineApprovedAt
      ? {
          text: `Đã duyệt ${dateOf(topic.outlineApprovedAt).slice(0, 5)}`,
          className: 'tpc-chip-ok',
        }
      : { text: 'Chờ duyệt', className: '' };
  if (group.kinds[0] === 'Cuối kỳ') {
    const locked = group.versions.findIndex(
      (v) => v.versionNo === topic.finalLockedVersionNo,
    );
    return locked >= 0
      ? { text: `Đã chốt Bản ${locked + 1}`, className: 'tpc-chip-ok' }
      : {
          text: `${count} phiên bản · chưa chốt bản cuối`,
          className: 'tpc-chip-warn',
        };
  }
  return { text: `${count} phiên bản`, className: '' };
}

// Màn Chi tiết đề tài của Giáo vụ (docs/DESIGN/03, artboard
// GiaoVu-ChiTietDeTai): chỉ xem, bốn tab Tổng quan, Báo cáo và phiên bản, Điểm,
// Lịch sử. Có cờ lệch điểm (chip ở đầu trang, ô đỏ và hộp cảnh báo ở tab Điểm;
// bốn cặp chéo, từ 2 điểm; PDR-007), quyết định 2026-11-02, bên cạnh màn Kết quả.
export const TopicDetailPage: React.FC<TopicDetailPageProps> = ({
  topicId,
  topicService = defaultTopicService,
  liveSubmissions = process.env.NEXT_PUBLIC_ROUNDS_API === 'true',
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
  const countOf = (c: HistoryCategory | 'Tất cả') =>
    c === 'Tất cả'
      ? topic.history.length
      : topic.history.filter((h) => h.category === c).length;
  const deviations = topic.scores.map((s) => ({
    score: s,
    ...scoreDeviations(s.scores),
  }));
  const hasDeviation = deviations.some((d) => d.pairs.length > 0);
  const steps = progressSteps(topic);
  const docGroups = DOC_GROUPS.map((g) => ({
    ...g,
    versions: topic.submissions.filter((s) => g.kinds.includes(s.kind)),
  })).filter((g) => g.versions.length > 0);
  const tabId = (id: TopicTab) => `tpc-tab-${id}`;
  const panelId = (id: TopicTab) => `tpc-panel-${id}`;

  return (
    <div className="tpc-page">
      <nav className="tpc-crumb" aria-label="Đường dẫn">
        <Link href={`${BACK_HREF}?dot=${topic.roundId}`}>Đề tài</Link>{' '}
        <span aria-hidden="true">/</span> {topic.code}
      </nav>

      <div className="tpc-detail-head">
        <div className="tpc-detail-title">
          <h1>{topic.title}</h1>
          <div className="tpc-meta">
            <TopicStatusChip status={topic.status} />
            {hasDeviation && (
              <span className="tpc-chip tpc-chip-deviation">Lệch điểm ≥ 2</span>
            )}
            <span>
              {topic.code} ·{' '}
              <Link href={`${BACK_HREF}?dot=${topic.roundId}`}>
                {roundName || 'Xem đợt'}
              </Link>{' '}
              · {topic.field} · {topic.source}
            </span>
          </div>
        </div>
        <Link className="tpc-btn" href="/giao-vu/ket-qua">
          Xem ở trang Kết quả
        </Link>
      </div>

      <div className="tpc-tabs" role="tablist" aria-label="Chi tiết đề tài">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            className="tpc-tab"
            aria-selected={tab === t.id}
            aria-controls={panelId(t.id)}
            onClick={() => setTabParam(t.id, 'replace')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id={panelId(tab)}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        className="tpc-page"
      >
        {tab === 'tong-quan' && (
          <div className="tpc-ov">
            <div className="tpc-col">
              <section className="tpc-card" aria-labelledby="tpc-progress-t">
                <h2 id="tpc-progress-t">Tiến độ 6 chặng</h2>
                <ol className="tpc-steps">
                  {steps.map((s) => (
                    <li key={s.name} className={s.done ? 'tpc-step-done' : ''}>
                      <span className="tpc-step-bar" aria-hidden="true" />
                      <span className="tpc-step-name">
                        {s.done ? '✓' : '○'} {s.name}
                      </span>
                      <span className="tpc-step-sub">{s.sub}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="tpc-card" aria-labelledby="tpc-desc-t">
                <h2 id="tpc-desc-t">Mô tả đề tài</h2>
                <p>{topic.description}</p>
                <h3>Yêu cầu</h3>
                <p>{topic.requirements}</p>
              </section>
            </div>
            <div className="tpc-col">
              <section className="tpc-card" aria-labelledby="tpc-group-t">
                <h2 id="tpc-group-t">Nhóm sinh viên</h2>
                {topic.group.length === 0 ? (
                  <p>Chưa có nhóm</p>
                ) : (
                  <ul className="tpc-members">
                    {topic.group.map((m) => (
                      <li key={m.id} className="tpc-member">
                        <span
                          className="tpc-avatar tpc-avatar-lg"
                          aria-hidden="true"
                        >
                          {avatarInitials(m.name)}
                        </span>
                        <span className="tpc-member-text">
                          <span className="tpc-member-name">{m.name}</span>
                          <span className="tpc-sub">
                            {m.code} · {m.className}
                            {m.representative && ' · Đại diện'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="tpc-card" aria-labelledby="tpc-assign-t">
                <h2 id="tpc-assign-t">Phân công và lịch bảo vệ</h2>
                <dl className="tpc-dl">
                  <dt>Hướng dẫn</dt>
                  <dd>{topic.supervisor.name}</dd>
                  <dt>Phản biện</dt>
                  <dd>{topic.reviewer?.name ?? 'Chưa phân công'}</dd>
                  <dt>Hội đồng</dt>
                  <dd>
                    {topic.defense
                      ? `${topic.defense.council} · ${
                          topic.defense.councilPublished
                            ? 'đã công bố'
                            : 'chưa công bố'
                        }`
                      : (topic.council ?? 'Chưa phân công')}
                  </dd>
                  {topic.defense ? (
                    <>
                      <dt>Chủ tịch</dt>
                      <dd>{topic.defense.chair}</dd>
                      <dt>Thư ký</dt>
                      <dd>{topic.defense.secretary}</dd>
                      <dt>Bảo vệ</dt>
                      <dd>{formatDefenseStart(topic.defense.start)}</dd>
                      <dt>Phòng</dt>
                      <dd>
                        {topic.defense.room} · thứ tự {topic.defense.order}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt>Bảo vệ</dt>
                      <dd>Chưa xếp lịch</dd>
                    </>
                  )}
                </dl>
              </section>
            </div>
          </div>
        )}

        {tab === 'bao-cao' && liveSubmissions && (
          <SubmissionPanel topicId={topic.id} />
        )}

        {tab === 'bao-cao' &&
          !liveSubmissions &&
          (docGroups.length === 0 ? (
            <p className="app-muted">Nhóm chưa nộp bài nào.</p>
          ) : (
            <div className="tpc-docs">
              <span id="tpc-dl-note" className="tpc-visually-hidden">
                Chưa có API tải tệp
              </span>
              {docGroups.map((g, gi) => {
                const status = docStatus(topic, g);
                const label = g.kinds[0] === 'Đề cương' ? 'Lần' : 'Bản';
                const ordered = [...g.versions].reverse();
                return (
                  <section
                    key={g.title}
                    className="tpc-doc"
                    aria-labelledby={`tpc-doc-${gi}`}
                  >
                    <div className="tpc-doc-head">
                      <h2 id={`tpc-doc-${gi}`}>{g.title}</h2>
                      <span className={`tpc-chip ${status.className}`}>
                        {status.text}
                      </span>
                    </div>
                    <ol className="tpc-vers">
                      {ordered.map((s: TopicSubmission, i) => (
                        <li key={s.versionNo} className="tpc-ver">
                          <span className="tpc-ver-no">
                            {label} {g.versions.length - i}
                          </span>
                          <span className="tpc-ver-col">
                            <span>{s.note}</span>
                            <small>{s.fileName}</small>
                          </span>
                          <span className="tpc-ver-col">
                            <span>
                              {dateOf(s.submittedAt).slice(0, 5)}{' '}
                              {timeOf(s.submittedAt)}
                            </span>
                            {s.late ? (
                              <span className="tpc-tag tpc-tag-late">
                                Nộp trễ
                              </span>
                            ) : (
                              i === 0 &&
                              g.versions.length > 1 && (
                                <span className="tpc-tag">Mới nhất</span>
                              )
                            )}
                          </span>
                          <button
                            type="button"
                            className="tpc-ver-dl"
                            aria-disabled="true"
                            aria-describedby="tpc-dl-note"
                            aria-label={`Tải ${s.fileName}`}
                            onClick={(e) => e.preventDefault()}
                          >
                            Tải
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </div>
          ))}

        {tab === 'diem' && (
          <>
            {topic.scores.length === 0 ? (
              <p className="app-muted">Chưa có phiếu điểm nào.</p>
            ) : (
              <div className="tpc-scores">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Sinh viên</th>
                      <th scope="col">Hướng dẫn</th>
                      <th scope="col">Phản biện</th>
                      <th scope="col">Chủ tịch</th>
                      <th scope="col">Thư ký</th>
                      <th scope="col">Điểm KL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviations.map(({ score: s, roles }) => {
                      const total = totalScore(s.scores);
                      const cell = (role: ScoreRole) =>
                        roles.has(role) ? (
                          <td
                            className="tpc-score-dev"
                            aria-describedby="tpc-dev-box"
                          >
                            {formatComponentScore(s.scores[role])}
                            <span className="tpc-visually-hidden">
                              {' '}
                              (lệch ≥ 2)
                            </span>
                          </td>
                        ) : (
                          <td>{formatComponentScore(s.scores[role])}</td>
                        );
                      return (
                        <tr key={s.studentId}>
                          <td>
                            <span className="tpc-scores-name">
                              <strong>{s.name}</strong>
                              <small>{s.code}</small>
                            </span>
                          </td>
                          {cell('CBHD')}
                          {cell('CBPB')}
                          {cell('CTHĐ')}
                          {cell('TKHĐ')}
                          <td>
                            {total === null ? (
                              <span className="tpc-score-total tpc-score-missing">
                                Chưa đủ điểm
                              </span>
                            ) : (
                              <span className="tpc-score-total">
                                {formatScore(total)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {hasDeviation && (
              <div id="tpc-dev-box" className="tpc-dev-box" role="note">
                <strong>Cờ lệch điểm hội đồng</strong>
                {deviations.flatMap(({ score: s, pairs }) =>
                  pairs.map((p) => (
                    <span key={`${s.studentId}-${p.council}-${p.lecturer}`}>
                      {s.name}: {ROLE_SHORT[p.council]}{' '}
                      {formatComponentScore(s.scores[p.council])} lệch{' '}
                      {ROLE_SHORT[p.lecturer]}{' '}
                      {formatComponentScore(s.scores[p.lecturer])} (
                      {formatComponentScore(p.diff)} điểm)
                    </span>
                  )),
                )}
              </div>
            )}
            <p className="tpc-foot">
              Điểm khóa luận = (CT + TK + HD × 2 + PB × 2) / 6, thang 10, làm
              tròn hai chữ số; chỉ tính khi đủ bốn phiếu. Kết quả chưa xác nhận:
              giảng viên vẫn sửa được điểm, mọi lần sửa được ghi ở tab Lịch sử.
            </p>
          </>
        )}

        {tab === 'lich-su' && (
          <>
            <div
              className="tpc-seg tpc-seg-sm"
              role="group"
              aria-label="Lọc lịch sử"
            >
              {(['Tất cả', ...HISTORY_CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c} ({countOf(c)})
                </button>
              ))}
            </div>
            <ol className="tpc-history" aria-label="Lịch sử thay đổi">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="tpc-when">
                    <time dateTime={h.at}>
                      <strong>{dateOf(h.at)}</strong>
                    </time>
                    <small>{timeOf(h.at)}</small>
                  </span>
                  <span>
                    <span className={`tpc-cat ${CATEGORY_CLASS[h.category]}`}>
                      {h.category}
                    </span>
                  </span>
                  <span className="tpc-history-text">
                    <span>
                      {h.action}
                      {h.detail ? `. ${h.detail}` : ''}
                    </span>
                    <span>{h.actor}</span>
                  </span>
                </li>
              ))}
              {history.length === 0 && (
                <li className="tpc-history-empty">
                  {topic.history.length === 0
                    ? 'Đề tài chưa có thay đổi nào.'
                    : `Không có mục nào thuộc “${category}”.`}
                </li>
              )}
            </ol>
            <p className="tpc-foot">
              Lịch sử chỉ để xem, ghi lại mọi thay đổi về trạng thái, nhóm đăng
              ký, bài nộp, phân công và điểm. Mới nhất ở trên.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
