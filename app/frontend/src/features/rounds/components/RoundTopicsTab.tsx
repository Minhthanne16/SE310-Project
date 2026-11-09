'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download, Search } from 'lucide-react';
import '@/features/rounds/rounds.css';
import {
  finalLockClosed,
  formatDate,
  publishBlocker,
  registrationClosed,
  registrationEnd,
  submissionClosed,
  submissionEnd,
} from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { ExportTopicsDialog } from '@/features/topics/components/ExportTopicsDialog';
import { PublishTopicsDialog } from '@/features/topics/components/PublishTopicsDialog';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  topicService as defaultTopicService,
  type ResultOutcome,
  type TopicService,
} from '@/features/topics/services/topicService';
import {
  buildRegistrationTable,
  buildTopicListTable,
  exportFileName,
  type TopicExportKind,
} from '@/features/topics/topicExport';
import {
  confirmResultBlocker,
  displayStatus,
  groupLabel,
  publishResultBlocker,
  remindDeviationBlocker,
  shortName,
  thesisCell,
} from '@/features/topics/topicUtils';
import { TopicResultPanel } from '@/features/rounds/components/TopicResultPanel';
import { downloadXlsx } from '@/lib/xlsx';
import {
  TOPIC_STATUSES,
  type Participant,
  type Round,
  type TopicStatus,
} from '@/types/round';
import type { LecturerLoad, Topic } from '@/types/topic';

interface RoundTopicsTabProps {
  round: Round;
  roundService?: RoundService;
  topicService?: TopicService;
  // Đợt mới sau khi công bố danh sách (để trang cha cập nhật tiêu đề, tab).
  onRoundChange?: (round: Round) => void;
  // Chuyển sang tab Cấu hình (lùi mốc đăng ký khi không công bố được).
  onGoToConfig?: () => void;
  // Tải tệp .xlsx về máy; tiêm được để kiểm thử.
  downloadFile?: typeof downloadXlsx;
}

// Trạng thái chấm điểm và kết quả: khi đợt có đề tài ở các trạng thái này, bảng
// có cột chọn theo lô và cột Thao tác (PDR-049).
const RESULT_STATUSES: readonly TopicStatus[] = [
  'Đang cho điểm',
  'Đã cho điểm',
  'Có lệch điểm',
  'Đã xác nhận',
  'Đã hoàn tất',
];

interface BulkReport {
  title: string;
  rows: ResultOutcome[];
}

const BULK_LABEL = {
  confirm: 'Xác nhận kết quả',
  publish: 'Công bố kết quả',
  remind: 'Nhắc lệch điểm',
} as const;
type BulkAction = keyof typeof BULK_LABEL;

const normalize = (value: string) => value.trim().toLowerCase();

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// Tab Đề tài của chi tiết đợt (artboard GiaoVu-DotKhoaLuan): giáo vụ xem đề tài
// của đợt, đóng & công bố danh sách cho sinh viên và xuất Excel ngay tại đây.
// Phân công phản biện và hội đồng làm ở trang Đề tài.
export const RoundTopicsTab: React.FC<RoundTopicsTabProps> = ({
  round,
  roundService = defaultRoundService,
  topicService = defaultTopicService,
  onRoundChange,
  onGoToConfig,
  downloadFile = downloadXlsx,
}) => {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [loads, setLoads] = useState<Record<string, LecturerLoad>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TopicStatus | 'Tất cả'>('Tất cả');
  const [publishing, setPublishing] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<Participant[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [report, setReport] = useState<BulkReport | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const today = roundService.today;
  // Hết hạn đăng ký (đã công bố): liệt kê sinh viên của đợt chưa có đề tài.
  const listUnassigned =
    round.status === 'Đang diễn ra' &&
    round.topicsPublishedAt !== null &&
    registrationClosed(round, today);

  useEffect(() => {
    let cancelled = false;
    setTopics(null);
    setLoadError(null);
    topicService
      .list({ roundId: round.id })
      .then((result) => {
        if (cancelled) return;
        setTopics(result.items);
        setLoads(result.loads);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được đề tài của đợt.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [topicService, round.id]);

  // Tải lại danh sách sau một thao tác kết quả mà không nháy "Đang tải".
  const refresh = async () => {
    const result = await topicService.list({ roundId: round.id });
    setTopics(result.items);
    setLoads(result.loads);
  };

  // Sau hạn đăng ký (đã công bố) không còn đề tài Đã đăng ký / Chờ GV duyệt và
  // ẩn đề xuất Bị từ chối (PDR-049); bản ghi vẫn nằm trong lịch sử đề tài.
  const registrationOver =
    round.topicsPublishedAt !== null && registrationClosed(round, today);
  // Mọi đề tài của đợt với trạng thái hiển thị; dùng cho xuất danh sách đăng ký.
  const everyTopic = useMemo(
    () =>
      (topics ?? []).map((t) => {
        const shown = displayStatus(t.status, registrationOver);
        return shown === t.status ? t : { ...t, status: shown };
      }),
    [topics, registrationOver],
  );
  const all = useMemo(
    () =>
      registrationOver
        ? everyTopic.filter((t) => t.status !== 'Bị từ chối')
        : everyTopic,
    [everyTopic, registrationOver],
  );
  const removedRejected = everyTopic.length - all.length;
  const lockClosed = finalLockClosed(round, today);
  const finishedRound = round.status === 'Đã kết thúc';
  const hasResults = all.some((t) => RESULT_STATUSES.includes(t.status));

  useEffect(() => {
    if (!listUnassigned || topics === null) {
      setUnassigned(null);
      return;
    }
    let cancelled = false;
    const grouped = new Set(topics.flatMap((t) => t.group.map((m) => m.id)));
    roundService
      .listParticipants('student')
      .then((people) => {
        if (cancelled) return;
        setUnassigned(
          people.filter(
            (p) => round.studentIds.includes(p.id) && !grouped.has(p.id),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setUnassigned(null);
      });
    return () => {
      cancelled = true;
    };
  }, [listUnassigned, topics, roundService, round.studentIds]);
  const query = normalize(search);

  const rows = useMemo(
    () =>
      all.filter(
        (t) =>
          (status === 'Tất cả' || t.status === status) &&
          (!query ||
            normalize(
              [t.code, t.title, groupLabel(t), t.supervisor.name].join(' '),
            ).includes(query)),
      ),
    [all, status, query],
  );

  // Chỉ liệt kê trạng thái đang có đề tài, kèm số đề tài.
  const filters = useMemo(
    () => [
      { label: 'Tất cả' as const, count: all.length },
      ...TOPIC_STATUSES.filter((s) => all.some((t) => t.status === s)).map(
        (s) => ({ label: s, count: all.filter((t) => t.status === s).length }),
      ),
    ],
    [all],
  );

  const selectedTopics = all.filter((t) => selected.includes(t.id));
  const eligible = (action: BulkAction) =>
    selectedTopics.filter((t) =>
      action === 'confirm'
        ? confirmResultBlocker(t) === null
        : action === 'publish'
          ? publishResultBlocker(t, lockClosed) === null
          : remindDeviationBlocker(t) === null,
    );
  const allVisibleChecked =
    rows.length > 0 && rows.every((t) => selected.includes(t.id));

  const toggleRow = (id: string) => {
    setReport(null);
    setConfirmingPublish(false);
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };
  const toggleAll = () => {
    setReport(null);
    setConfirmingPublish(false);
    const visible = rows.map((t) => t.id);
    setSelected((cur) =>
      allVisibleChecked
        ? cur.filter((id) => !visible.includes(id))
        : [...cur, ...visible.filter((id) => !cur.includes(id))],
    );
  };
  const toggleExpand = (id: string) =>
    setExpanded((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  // Chạy cho cả lô đã chọn; dịch vụ kiểm tra lại từng đề tài và báo lý do bỏ qua.
  const runBulk = async (action: BulkAction) => {
    if (bulkBusy) return;
    setBulkBusy(true);
    setConfirmingPublish(false);
    try {
      const ids = selectedTopics.map((t) => t.id);
      const outcomes =
        action === 'confirm'
          ? await topicService.confirmResults(ids)
          : action === 'publish'
            ? await topicService.publishResults(ids)
            : await topicService.remindDeviations(ids);
      const ok = outcomes.filter((o) => o.ok).length;
      setReport({
        title: `${BULK_LABEL[action]}: ${ok} thành công, ${outcomes.length - ok} bị bỏ qua`,
        rows: [...outcomes].sort((a, b) => Number(b.ok) - Number(a.ok)),
      });
      setSelected([]);
      await refresh();
    } catch (err: unknown) {
      setReport({
        title: `${BULK_LABEL[action]}: không thực hiện được`,
        rows: [
          {
            topicId: 'error',
            code: '',
            title: '',
            ok: false,
            message: errorMessage(err, 'Có lỗi khi xử lý lô đề tài.'),
          },
        ],
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const closePublish = () => {
    setPublishing(false);
    setPublishError(null);
  };

  const publish = async () => {
    if (publishBusy) return;
    setPublishBusy(true);
    setPublishError(null);
    try {
      const updated = await roundService.markTopicsPublished(round.id);
      setPublishing(false);
      setJustPublished(true);
      onRoundChange?.(updated);
    } catch (err: unknown) {
      setPublishError(errorMessage(err, 'Không công bố được danh sách.'));
    } finally {
      setPublishBusy(false);
    }
  };

  const exportList = async (kind: TopicExportKind) => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    try {
      let table;
      let text: string;
      if (kind === 'topics') {
        table = buildTopicListTable(rows);
        text = `Đã tải tệp Excel danh sách đề tài (${rows.length} đề tài theo bộ lọc hiện tại, kèm trạng thái).`;
      } else {
        const people = await roundService.listParticipants('student');
        const students = people.filter((p) => round.studentIds.includes(p.id));
        table = buildRegistrationTable(students, everyTopic);
        text = `Đã tải tệp Excel danh sách đăng ký của đợt (${students.length} sinh viên, kèm trạng thái đăng ký).`;
      }
      await downloadFile(exportFileName(kind, round.name), table);
      setExporting(false);
      toast.success(text);
    } catch (err: unknown) {
      setExportError(errorMessage(err, 'Không xuất được tệp Excel.'));
    } finally {
      setExportBusy(false);
    }
  };

  if (loadError)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{loadError}</p>
      </section>
    );

  if (topics === null)
    return (
      <p role="status" className="rnd-hint">
        Đang tải đề tài...
      </p>
    );

  const columnCount =
    6 + (hasResults ? 1 : 0) + (hasResults && !finishedRound ? 1 : 0);
  const clearable = all.length > 0 && (status !== 'Tất cả' || query !== '');
  const empty = rows.length === 0;
  const live = round.status === 'Đang diễn ra';
  const published = round.topicsPublishedAt !== null;
  const belowMin = Object.values(loads).filter(
    (l) => l.level === 'below',
  ).length;
  // Công bố bị chặn vì chưa có đề tài hoặc đợt không Đang diễn ra: nút tắt.
  // Hết hạn đăng ký thì nút vẫn mở để hộp thoại giải thích và dẫn tới Cấu hình.
  const noTopics = all.length === 0;
  const publishDisabled = published || noTopics;
  const subEnd = formatDate(submissionEnd(round));
  const regEnd = formatDate(registrationEnd(round));

  let strip: {
    tone: 'grey' | 'amber' | 'red' | 'green';
    head: string;
    text: string;
    config?: boolean;
  } | null = null;
  if (live) {
    if (published) {
      const closed = registrationClosed(round, today);
      strip =
        justPublished || !closed
          ? {
              tone: 'green',
              head: 'Đã công bố danh sách đề tài.',
              text: `Sinh viên trong đợt đã nhận thông báo và đăng ký được đến 23:59 ngày ${regEnd}; hết hạn, đăng ký tự đóng.`,
            }
          : {
              tone: 'green',
              head: `Đã công bố danh sách ngày ${formatDate(
                (round.topicsPublishedAt ?? '').slice(0, 10),
              )}.`,
              text: `Đăng ký đã tự đóng lúc 23:59 ngày ${regEnd}; đề tài chưa có nhóm chuyển sang Không có nhóm và không tính khi kết thúc đợt.`,
            };
    } else if (registrationClosed(round, today)) {
      strip = {
        tone: 'red',
        head: 'Chưa công bố và hạn đăng ký đã qua',
        text: `(23:59 ngày ${regEnd}). Lùi mốc “Công bố đề tài · SV đăng ký” ở tab Cấu hình rồi mới công bố.`,
        config: true,
      };
    } else if (submissionClosed(round, today)) {
      strip = {
        tone: 'amber',
        head: 'Đã hết hạn giảng viên gửi đề tài',
        text: `(23:59 ngày ${subEnd}). Xem lại danh sách rồi đóng và công bố để sinh viên đăng ký đến 23:59 ngày ${regEnd}.`,
      };
    } else {
      strip = {
        tone: 'grey',
        head: 'Giảng viên đang gửi đề tài',
        text: `đến 23:59 ngày ${subEnd}. Giáo vụ tự kiểm tra danh sách; có thể đóng và công bố sớm khi đã đủ đề tài.`,
      };
    }
  }

  return (
    <div className="rnd-panel" aria-label="Đề tài của đợt">
      <div className="rnd-people-tools" role="search" aria-label="Lọc đề tài">
        <div className="rnd-people-search">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="round-topic-q" className="app-visually-hidden">
            Tìm đề tài
          </label>
          <input
            id="round-topic-q"
            type="search"
            placeholder="Tìm theo mã, tên đề tài hoặc giảng viên"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rnd-select"
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as TopicStatus | 'Tất cả')}
        >
          {filters.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label} ({f.count})
            </option>
          ))}
        </select>
        <Link
          className="rnd-btn rnd-btn-lg"
          href={`/giao-vu/de-tai?dot=${encodeURIComponent(round.id)}`}
        >
          Mở trang Đề tài
        </Link>
        <div className="rnd-topics-actions">
          <button
            type="button"
            className="rnd-btn rnd-btn-lg"
            aria-haspopup="dialog"
            disabled={noTopics}
            title={noTopics ? 'Đợt chưa có đề tài để xuất.' : undefined}
            onClick={() => {
              setExportError(null);
              setExporting(true);
            }}
          >
            <Download size={16} aria-hidden="true" />
            Xuất danh sách
          </button>
          {live && (
            <button
              type="button"
              className="rnd-btn rnd-btn-lg rnd-btn-primary"
              aria-haspopup="dialog"
              disabled={publishDisabled}
              title={
                published
                  ? undefined
                  : noTopics
                    ? 'Chưa có đề tài để công bố.'
                    : (publishBlocker(round, today) ?? undefined)
              }
              onClick={() => {
                setPublishError(null);
                setPublishing(true);
              }}
            >
              {published ? 'Đã công bố danh sách' : 'Đóng & công bố danh sách'}
            </button>
          )}
        </div>
      </div>

      {strip && (
        <div
          role="note"
          aria-label="Tình trạng công bố danh sách"
          className={`rnd-strip rnd-strip-${strip.tone}`}
        >
          <p>
            <b>{strip.head}</b> {strip.text}
          </p>
          {strip.config && onGoToConfig && (
            <button type="button" className="rnd-btn" onClick={onGoToConfig}>
              Mở tab Cấu hình
            </button>
          )}
        </div>
      )}

      {unassigned !== null && unassigned.length > 0 && (
        <div
          role="note"
          aria-label="Sinh viên chưa có đề tài"
          className="rnd-strip rnd-strip-amber"
        >
          <details>
            <summary>
              <b>Việc cần làm: {unassigned.length} sinh viên chưa có đề tài</b>{' '}
              sau khi hết hạn đăng ký. Liên hệ để ghép nhóm hoặc đề xuất đề tài.
            </summary>
            <ul className="rnd-unassigned">
              {unassigned.map((p) => (
                <li key={p.id}>
                  {p.code} · {p.name}
                  {p.unit ? ` · ${p.unit}` : ''}
                  {p.email ? ` · ${p.email}` : ''}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <span className="rnd-hint" role="status">
        {rows.length} / {all.length} đề tài
      </span>

      {hasResults && !finishedRound && selectedTopics.length > 0 && (
        <div
          className="rnd-bulk-bar"
          role="toolbar"
          aria-label="Thao tác theo lô"
        >
          <b>Đã chọn {selectedTopics.length} đề tài</b>
          <button
            type="button"
            className="rnd-btn rnd-btn-sm rnd-btn-primary"
            disabled={bulkBusy}
            onClick={() => void runBulk('confirm')}
          >
            Xác nhận ({eligible('confirm').length})
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-sm rnd-btn-primary"
            disabled={bulkBusy || eligible('publish').length === 0}
            onClick={() => setConfirmingPublish(true)}
          >
            Công bố ({eligible('publish').length})
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-sm"
            disabled={bulkBusy}
            onClick={() => void runBulk('remind')}
          >
            Gửi nhắc lệch điểm ({eligible('remind').length})
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-sm"
            onClick={() => {
              setSelected([]);
              setConfirmingPublish(false);
            }}
          >
            Bỏ chọn
          </button>
          {confirmingPublish && (
            <div
              className="rnd-inline-confirm"
              role="group"
              aria-label="Xác nhận công bố theo lô"
            >
              <p>
                Công bố kết quả cho {eligible('publish').length} đề tài hợp lệ
                {selectedTopics.length > eligible('publish').length
                  ? `; ${selectedTopics.length - eligible('publish').length} đề tài không hợp lệ sẽ bị bỏ qua và báo lý do`
                  : ''}
                ? Công bố xong không mở lại được.
              </p>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-primary"
                disabled={bulkBusy}
                onClick={() => void runBulk('publish')}
              >
                Công bố
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm"
                onClick={() => setConfirmingPublish(false)}
              >
                Để sau
              </button>
            </div>
          )}
        </div>
      )}

      {report && (
        <section className="rnd-report" aria-label="Báo cáo thao tác theo lô">
          <header>
            <b>{report.title}</b>
            <button
              type="button"
              className="rnd-btn rnd-btn-sm"
              onClick={() => setReport(null)}
            >
              Đóng báo cáo
            </button>
          </header>
          <ul>
            {report.rows.map((r) => (
              <li
                key={r.topicId}
                className={r.ok ? 'rnd-report-ok' : 'rnd-report-skip'}
              >
                <span className="rnd-report-mark">
                  {r.ok ? 'Thành công' : 'Bỏ qua'}
                </span>
                <span>
                  {r.code && <b>{r.code}</b>}
                  {r.title && <span className="rnd-meta"> {r.title}</span>}
                  <br />
                  {r.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rnd-people-box">
        <table className="rnd-table rnd-table-topics">
          <thead>
            <tr>
              {hasResults && !finishedRound && (
                <th scope="col" className="rnd-col-check">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả đề tài đang hiển thị"
                    checked={allVisibleChecked}
                    disabled={rows.length === 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th scope="col">Đề tài</th>
              <th scope="col">GV hướng dẫn</th>
              <th scope="col">GV phản biện</th>
              <th scope="col">Hội đồng</th>
              <th scope="col">Khóa luận</th>
              <th scope="col">Trạng thái</th>
              {hasResults && <th scope="col">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const thesis = thesisCell(t);
              const open = expanded.includes(t.id);
              return (
                <React.Fragment key={t.id}>
                  <tr aria-selected={selected.includes(t.id) || undefined}>
                    {hasResults && !finishedRound && (
                      <td className="rnd-col-check">
                        <input
                          type="checkbox"
                          aria-label={`Chọn đề tài ${t.code}`}
                          checked={selected.includes(t.id)}
                          onChange={() => toggleRow(t.id)}
                        />
                      </td>
                    )}
                    <td>
                      <span className="rnd-person">
                        <Link
                          className="rnd-row-link"
                          href={`/giao-vu/de-tai/${encodeURIComponent(t.id)}`}
                        >
                          {t.title}
                        </Link>
                        <span className="rnd-meta">
                          {t.code} · {groupLabel(t)}
                        </span>
                      </span>
                    </td>
                    <td>{shortName(t.supervisor.name)}</td>
                    <td className={t.reviewer ? '' : 'rnd-cell-warn'}>
                      {t.reviewer
                        ? shortName(t.reviewer.name)
                        : 'Chưa phân công'}
                    </td>
                    <td className={t.council ? '' : 'rnd-cell-warn'}>
                      {t.council ?? 'Chưa gán'}
                    </td>
                    <td>
                      <span className="rnd-person">
                        <b>{thesis.label}</b>
                        <span className="rnd-meta">{thesis.sub}</span>
                      </span>
                    </td>
                    <td>
                      <TopicStatusChip status={t.status} />
                    </td>
                    {hasResults && (
                      <td>
                        <button
                          type="button"
                          className="rnd-btn rnd-btn-sm"
                          aria-expanded={open}
                          aria-controls={`result-${t.id}`}
                          aria-label={`${open ? 'Thu gọn' : 'Chi tiết'} ${t.code}`}
                          onClick={() => toggleExpand(t.id)}
                        >
                          {open ? 'Thu gọn' : 'Chi tiết'}
                        </button>
                      </td>
                    )}
                  </tr>
                  {open && hasResults && (
                    <tr id={`result-${t.id}`} className="rnd-expand-row">
                      <td colSpan={columnCount}>
                        <TopicResultPanel
                          topic={t}
                          topicService={topicService}
                          finalLockClosed={lockClosed}
                          readOnly={finishedRound}
                          onChanged={refresh}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {empty && (
              <tr>
                <td colSpan={columnCount} className="rnd-empty-cell">
                  <b>
                    {all.length === 0
                      ? 'Chưa có đề tài nào trong đợt'
                      : 'Không có đề tài nào khớp bộ lọc'}
                  </b>
                  <span>
                    {all.length === 0
                      ? round.status === 'Nháp'
                        ? 'Đợt đang Nháp. Đề tài giảng viên gửi và đề tài sinh viên đề xuất sẽ hiện ở đây sau khi đợt bắt đầu.'
                        : 'Đề tài giảng viên gửi và đề tài sinh viên đề xuất được chấp nhận sẽ hiện ở đây.'
                      : 'Thử chọn trạng thái khác hoặc xóa từ khóa tìm kiếm.'}
                  </span>
                  {clearable && (
                    <button
                      type="button"
                      className="rnd-btn rnd-btn-sm"
                      onClick={() => {
                        setSearch('');
                        setStatus('Tất cả');
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="rnd-foot">
        {round.status === 'Đã kết thúc'
          ? 'Đợt đã kết thúc nên danh sách chỉ để xem; vẫn xuất được tệp Excel.'
          : 'Đóng & công bố danh sách và xuất Excel làm ngay tại tab này. Phân công phản biện, hội đồng làm ở trang Đề tài. Kết quả xác nhận và công bố theo cả nhóm đề tài.'}
      </p>
      {removedRejected > 0 && (
        <p className="rnd-foot">
          Đã gỡ {removedRejected} đề xuất bị từ chối khỏi danh sách sau hạn đăng
          ký; vẫn xem được trong lịch sử đề tài.
        </p>
      )}

      {publishing && (
        <PublishTopicsDialog
          round={round}
          today={today}
          belowMin={belowMin}
          busy={publishBusy}
          error={publishError}
          onCancel={closePublish}
          onConfirm={() => void publish()}
          onGoToConfig={() => {
            closePublish();
            onGoToConfig?.();
          }}
        />
      )}

      {exporting && (
        <ExportTopicsDialog
          roundName={round.name}
          filteredCount={rows.length}
          busy={exportBusy}
          error={exportError}
          onCancel={() => setExporting(false)}
          onConfirm={(kind) => void exportList(kind)}
        />
      )}
    </div>
  );
};
