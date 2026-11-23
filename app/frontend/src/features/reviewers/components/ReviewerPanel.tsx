'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import '@/features/topics/topics.css';
import '@/features/reviewers/reviewers.css';
import {
  applySuggestions,
  assignMany,
  buildBatch,
  dirtyRows,
  initialDraft,
  isEditable,
  projectedLoad,
  type ReviewerDraft,
} from '@/features/reviewers/reviewerDraft';
import {
  reviewerService as defaultReviewerService,
  type ReviewerService,
} from '@/features/reviewers/services/reviewerService';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type { Round } from '@/types/round';
import type {
  ReviewerAssignments,
  ReviewerLecturer,
  ReviewerTopicRow,
} from '@/types/reviewer';

export interface ReviewerPanelProps {
  mode?: 'edit' | 'view';
  roundId?: string;
  embedded?: boolean;
  service?: ReviewerService;
  roundService?: Pick<RoundService, 'list'>;
}

type DialogState = 'suggest' | 'save' | null;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const LOCKED_CHIP = 'Đã khóa · có phiếu phản biện';

export const ReviewerPanel: React.FC<ReviewerPanelProps> = ({
  mode = 'edit',
  roundId: propRoundId,
  embedded = false,
  service = defaultReviewerService,
  roundService = defaultRoundService,
}) => {
  const isViewOnly = mode === 'view';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const urlRound = searchParams?.get('dot') ?? '';

  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState(propRoundId ?? '');
  const [data, setData] = useState<ReviewerAssignments | null>(null);
  const [draft, setDraft] = useState<ReviewerDraft>({});
  const [suggested, setSuggested] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkLecturer, setBulkLecturer] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propRoundId) {
      setRoundId(propRoundId);
    }
  }, [propRoundId]);

  useEffect(() => {
    if (propRoundId) return;
    let cancelled = false;
    roundService
      .list()
      .then((list) => {
        if (cancelled) return;
        const visible = list.filter((r) => r.status !== 'Nháp');
        setRounds(visible);
        const preferred =
          visible.find((r) => r.id === urlRound) ??
          visible.find((r) => r.status === 'Đang diễn ra') ??
          visible[0];
        setRoundId(preferred?.id ?? '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, 'Không tải được đợt.'));
      });
    return () => {
      cancelled = true;
    };
  }, [roundService, urlRound, propRoundId]);

  const load = useCallback(
    async (id: string, keep: ReviewerDraft = {}) => {
      try {
        setError(null);
        const result = await service.list(id);
        setData(result);
        setDraft({ ...initialDraft(result.topics), ...keep });
      } catch (err: unknown) {
        setError(errorText(err, 'Không tải được danh sách phân công.'));
      }
    },
    [service],
  );

  useEffect(() => {
    if (!roundId) return;
    setData(null);
    setSuggested([]);
    setNotes({});
    setRowErrors({});
    setSelected([]);
    void load(roundId);
  }, [roundId, load]);

  const changeRound = (id: string) => {
    setRoundId(id);
    if (!propRoundId) {
      router.replace(`${pathname}?dot=${encodeURIComponent(id)}`);
    }
  };

  const current = data && data.round.id === roundId ? data : null;
  const topics = useMemo(() => current?.topics ?? [], [current]);
  const lecturers = useMemo(() => current?.lecturers ?? [], [current]);
  const mainRows = topics.filter((t) => t.eligible || t.reviewer);
  const blockedRows = topics.filter((t) => !t.eligible && !t.reviewer);
  const dirty = useMemo(() => dirtyRows(topics, draft), [topics, draft]);
  const projected = useMemo(
    () => projectedLoad(lecturers, topics, draft),
    [lecturers, topics, draft],
  );
  const max = current?.round.loadMax ?? 0;
  const overLoaded =
    max > 0 ? lecturers.filter((l) => projected[l.id] > max) : [];
  const editableIds = mainRows.filter(isEditable).map((r) => r.topicId);
  const canSuggest =
    !isViewOnly &&
    mainRows.some((r) => isEditable(r) && !r.reviewer && !draft[r.topicId]);

  const choose = (topicId: string, value: string) => {
    if (isViewOnly) return;
    setDraft((d) => ({ ...d, [topicId]: value }));
    setSuggested((s) => s.filter((id) => id !== topicId));
    setRowErrors(({ [topicId]: _removed, ...rest }) => rest);
  };

  const toggle = (topicId: string) => {
    if (isViewOnly) return;
    setSelected((s) =>
      s.includes(topicId) ? s.filter((id) => id !== topicId) : [...s, topicId],
    );
  };
  const allSelected =
    !isViewOnly &&
    editableIds.length > 0 &&
    editableIds.every((id) => selected.includes(id));

  const applyBulk = () => {
    if (isViewOnly || !bulkLecturer) return;
    const result = assignMany(topics, draft, selected, bulkLecturer);
    setDraft(result.draft);
    setSuggested((s) => s.filter((id) => !selected.includes(id)));
    setSelected([]);
    if (result.applied === 0)
      toast.error(
        'Không điền được dòng nào: các đề tài đã chọn là của GVHD này, đã khóa hoặc chưa đủ điều kiện.',
      );
    else
      toast.success(
        `Đã điền sẵn ${result.applied} đề tài${
          result.skipped > 0
            ? `, bỏ qua ${result.skipped} (GVHD, đã khóa hoặc chưa đủ điều kiện)`
            : ''
        }. Chưa lưu: bấm “Lưu và gửi thông báo”.`,
      );
  };

  const runSuggest = async () => {
    if (!roundId || busy || isViewOnly) return;
    setBusy(true);
    setDialogError(null);
    try {
      const suggestions = await service.suggest(roundId);
      const result = applySuggestions(topics, draft, suggestions);
      setDraft(result.draft);
      setSuggested((s) => [...new Set([...s, ...result.applied])]);
      setNotes(result.notes);
      setDialog(null);
      if (result.applied.length === 0)
        toast.error(
          'Không có gợi ý phù hợp. Chọn giảng viên cho từng đề tài ở cột “GV phản biện”.',
        );
      else
        toast.success(
          `Đã điền sẵn ${result.applied.length} gợi ý. Chưa lưu: kiểm tra rồi bấm “Lưu và gửi thông báo”.`,
        );
    } catch (err: unknown) {
      setDialogError(errorText(err, 'Không lấy được gợi ý. Thử lại sau.'));
    } finally {
      setBusy(false);
    }
  };

  const runSave = async () => {
    if (!roundId || dirty.length === 0 || busy || isViewOnly) return;
    setBusy(true);
    setDialogError(null);
    try {
      const result = await service.batch(roundId, buildBatch(topics, draft));
      const failed = result.results.filter((r) => !r.ok);
      const errors = Object.fromEntries(
        failed.map((r) => [r.topicId, r.message]),
      );
      const keep = Object.fromEntries(
        failed.map((r) => [r.topicId, draft[r.topicId]]),
      );
      setDialog(null);
      setRowErrors(errors);
      setSuggested((s) => s.filter((id) => id in errors));
      setNotes({});
      setSelected([]);
      if (result.failed === 0)
        toast.success(
          `Đã lưu ${result.succeeded} phân công và gửi thông báo cho giảng viên phản biện.`,
        );
      else if (result.succeeded === 0)
        toast.error(
          `Không lưu được phân công nào (${result.failed} dòng lỗi). Xem lỗi tại từng dòng.`,
        );
      else
        toast.error(
          `Đã lưu ${result.succeeded} phân công; ${result.failed} dòng lỗi, xem lỗi tại từng dòng.`,
        );
      await load(roundId, keep);
    } catch (err: unknown) {
      setDialogError(errorText(err, 'Không lưu được. Thử lại sau.'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !current)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được phân công phản biện</h2>
        <p>{error}</p>
      </section>
    );

  if (!propRoundId && rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải phân công phản biện…
      </p>
    );

  return (
    <div className="rvw-page">
      {!embedded && (
        <div className="app-page-heading">
          <h1>Giảng viên phản biện</h1>
          <p>
            {isViewOnly
              ? 'Xem danh sách phân công giảng viên phản biện cho từng đề tài. Để phân công hoặc sửa, mở tab Đánh giá trong chi tiết đợt.'
              : 'Phân công giảng viên phản biện cho từng đề tài đã duyệt đề cương. “Tự gợi ý” chỉ điền sẵn, chưa lưu cho tới khi bạn bấm “Lưu và gửi thông báo”.'}
          </p>
        </div>
      )}

      {!propRoundId && rounds && rounds.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Chưa có đợt khóa luận nào đã mở để phân công phản biện.</p>
        </section>
      ) : (
        <>
          <div className="rvw-toolbar">
            {!propRoundId && rounds && (
              <div className="tpc-round-row">
                <label htmlFor="pb-round">Đợt</label>
                <select
                  id="pb-round"
                  className="tpc-select"
                  value={roundId}
                  onChange={(e) => changeRound(e.target.value)}
                  disabled={busy}
                >
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="rvw-toolbar-spacer" />
            {!isViewOnly && (
              <>
                <button
                  type="button"
                  className="app-button"
                  onClick={() => {
                    setDialogError(null);
                    setDialog('suggest');
                  }}
                  disabled={!current || !canSuggest || busy}
                >
                  Tự gợi ý
                </button>
                <button
                  type="button"
                  className="app-button app-button-primary"
                  onClick={() => {
                    setDialogError(null);
                    setDialog('save');
                  }}
                  disabled={dirty.length === 0 || busy}
                >
                  {dirty.length > 0
                    ? `Lưu và gửi thông báo (${dirty.length})`
                    : 'Lưu và gửi thông báo'}
                </button>
              </>
            )}
          </div>

          {!current ? (
            <p role="status" className="app-muted">
              Đang tải danh sách đề tài…
            </p>
          ) : topics.length === 0 ? (
            <section className="status-state app-empty">
              <h2>Chưa có đề tài</h2>
              <p>Đợt này chưa có đề tài nào để phân công phản biện.</p>
            </section>
          ) : (
            <div className="rvw-layout">
              <div className="rvw-main">
                {overLoaded.length > 0 && !isViewOnly && (
                  <div role="note" className="rvw-note">
                    Vượt mức tối đa {max} đề tài phản biện của đợt:{' '}
                    {overLoaded
                      .map((l) => `${l.name} (${projected[l.id]})`)
                      .join(', ')}
                    . Vẫn lưu được; đây chỉ là cảnh báo.
                  </div>
                )}

                {!isViewOnly && selected.length > 0 && (
                  <div
                    className="rvw-bulk"
                    role="group"
                    aria-label="Gán hàng loạt"
                  >
                    <span>{`${selected.length} đề tài đã chọn`}</span>
                    <label htmlFor="pb-bulk" className="app-visually-hidden">
                      Giảng viên phản biện cho các đề tài đã chọn
                    </label>
                    <select
                      id="pb-bulk"
                      className="tpc-select rvw-select"
                      value={bulkLecturer}
                      onChange={(e) => setBulkLecturer(e.target.value)}
                    >
                      <option value="">Chọn giảng viên</option>
                      {lecturers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {lecturerLabel(l, projected[l.id], max)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="app-button app-button-small"
                      onClick={applyBulk}
                      disabled={!bulkLecturer}
                    >
                      Gán hàng loạt
                    </button>
                    <button
                      type="button"
                      className="app-button app-button-small"
                      onClick={() => setSelected([])}
                    >
                      Bỏ chọn
                    </button>
                  </div>
                )}

                {mainRows.length === 0 ? (
                  <p className="app-muted">
                    Chưa có đề tài nào đủ điều kiện phân công.
                  </p>
                ) : (
                  <div className="app-table-scroll">
                    <table className="app-table">
                      <thead>
                        <tr>
                          {!isViewOnly && (
                            <th scope="col">
                              <input
                                type="checkbox"
                                className="rvw-check"
                                aria-label="Chọn tất cả đề tài sửa được"
                                checked={allSelected}
                                disabled={editableIds.length === 0}
                                onChange={() =>
                                  setSelected(allSelected ? [] : editableIds)
                                }
                              />
                            </th>
                          )}
                          <th scope="col">Mã</th>
                          <th scope="col">Đề tài</th>
                          <th scope="col">Lĩnh vực</th>
                          <th scope="col">GVHD</th>
                          <th scope="col">Nhóm</th>
                          <th scope="col">Điều kiện</th>
                          <th scope="col">GV phản biện</th>
                          {isViewOnly && (
                            <th scope="col">
                              <span className="app-visually-hidden">
                                Thao tác
                              </span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {mainRows.map((row) => (
                          <ReviewerRow
                            key={row.topicId}
                            row={row}
                            value={draft[row.topicId] ?? ''}
                            lecturers={lecturers}
                            projected={projected}
                            max={max}
                            suggested={suggested.includes(row.topicId)}
                            note={notes[row.topicId]}
                            error={rowErrors[row.topicId]}
                            checked={selected.includes(row.topicId)}
                            disabled={busy || isViewOnly}
                            isViewOnly={isViewOnly}
                            roundId={roundId}
                            onChoose={choose}
                            onToggle={toggle}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {blockedRows.length > 0 && (
                  <section
                    className="rvw-block"
                    aria-labelledby="pb-blocked-title"
                  >
                    <h2 id="pb-blocked-title">
                      {`Chưa đủ điều kiện (${blockedRows.length})`}
                    </h2>
                    <ul className="rvw-block-list">
                      {blockedRows.map((row) => (
                        <li key={row.topicId} className="rvw-block-item">
                          <span className="rvw-nowrap">{row.code}</span>
                          <span>{row.title}</span>
                          <span className="app-chip app-chip-pending">
                            {row.blockedReason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              <aside className="rvw-load" aria-labelledby="pb-load-title">
                <h2 id="pb-load-title">Tải của giảng viên</h2>
                <ul className="rvw-load-list">
                  {lecturers.map((l) => {
                    const count = projected[l.id] ?? l.reviewCount;
                    const over = max > 0 && count > max;
                    return (
                      <li key={l.id}>
                        <div className="rvw-load-head">
                          <span>{`${l.name} (${l.code})`}</span>
                          {over && (
                            <span className="app-chip app-chip-pending">
                              Vượt mức
                            </span>
                          )}
                        </div>
                        <progress
                          className="rvw-load-bar"
                          data-over={over}
                          max={max > 0 ? max : Math.max(count, 1)}
                          value={count}
                          aria-label={`Đề tài phản biện của ${l.name}`}
                        />
                        <span className="rvw-load-meta">
                          {`${count}${max > 0 ? ` / ${max}` : ''} đề tài phản biện · ${l.superviseCount} hướng dẫn`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>
          )}
        </>
      )}

      {dialog === 'suggest' && (
        <ConfirmDialog
          title="Tự gợi ý giảng viên phản biện?"
          description="Hệ thống điền sẵn giảng viên cho các đề tài đủ điều kiện và chưa có phản biện: ưu tiên cùng lĩnh vực, rồi người đang phản biện ít hơn, bỏ giảng viên đã đạt mức tối đa của đợt và GVHD của đề tài. Gợi ý chưa được lưu; bạn xem, sửa rồi bấm “Lưu và gửi thông báo”."
          cancelLabel="Hủy"
          confirmLabel="Điền sẵn gợi ý"
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={() => void runSuggest()}
        />
      )}
      {dialog === 'save' && (
        <ConfirmDialog
          title="Lưu và gửi thông báo?"
          description={`Lưu ${dirty.length} phân công và gửi thông báo cho giảng viên phản biện. Khi đổi người, giảng viên cũ cũng nhận thông báo. Từ phiếu phản biện đầu tiên, không đổi người được nữa.`}
          cancelLabel="Quay lại"
          confirmLabel="Lưu và gửi thông báo"
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={() => void runSave()}
        />
      )}
    </div>
  );
};

function lecturerLabel(l: ReviewerLecturer, count: number, max: number) {
  return `${l.name} (${l.code}) · đang PB ${count}${max > 0 ? `/${max}` : ''}`;
}

interface RowProps {
  row: ReviewerTopicRow;
  value: string;
  lecturers: ReviewerLecturer[];
  projected: Record<string, number>;
  max: number;
  suggested: boolean;
  note?: string;
  error?: string;
  checked: boolean;
  disabled: boolean;
  isViewOnly?: boolean;
  roundId?: string;
  onChoose: (topicId: string, value: string) => void;
  onToggle: (topicId: string) => void;
}

const ReviewerRow: React.FC<RowProps> = ({
  row,
  value,
  lecturers,
  projected,
  max,
  suggested,
  note,
  error,
  checked,
  disabled,
  isViewOnly = false,
  roundId = '',
  onChoose,
  onToggle,
}) => {
  const editable = isEditable(row);
  const changed =
    editable && value !== '' && value !== (row.reviewer?.id ?? '');
  const describedBy =
    [
      row.locked ? `pb-lock-${row.topicId}` : null,
      !row.eligible && !row.locked ? `pb-block-${row.topicId}` : null,
      error ? `pb-err-${row.topicId}` : null,
      note ? `pb-note-${row.topicId}` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const reviewerKnown = row.reviewer
    ? lecturers.some((l) => l.id === row.reviewer!.id)
    : true;

  return (
    <tr>
      {!isViewOnly && (
        <td>
          <input
            type="checkbox"
            className="rvw-check"
            aria-label={`Chọn ${row.code}`}
            checked={checked}
            disabled={!editable || disabled}
            onChange={() => onToggle(row.topicId)}
          />
        </td>
      )}
      <td className="rvw-nowrap">{row.code}</td>
      <td className="rvw-cell-title">{row.title}</td>
      <td>{row.field}</td>
      <td>{row.supervisor.name}</td>
      <td>
        {row.group.length > 0
          ? row.group.map((m) => `${m.name} (${m.code})`).join(', ')
          : '—'}
      </td>
      <td>
        <span className="rvw-chips">
          {row.locked ? (
            <span className="app-chip app-chip-pending">{LOCKED_CHIP}</span>
          ) : row.eligible ? (
            <span className="app-chip app-chip-active">Đủ điều kiện</span>
          ) : (
            <span className="app-chip app-chip-pending">
              {row.blockedReason}
            </span>
          )}
          {suggested && <span className="app-chip app-chip-info">Gợi ý</span>}
          {changed && !suggested && (
            <span className="app-chip app-chip-info">Chưa lưu</span>
          )}
        </span>
      </td>
      <td>
        {isViewOnly ? (
          <span>
            {row.reviewer ? `${row.reviewer.name} (${row.reviewer.code})` : '—'}
          </span>
        ) : (
          <>
            <select
              className="tpc-select rvw-select"
              aria-label={`Giảng viên phản biện ${row.code}`}
              value={value}
              disabled={!editable || disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(e) => onChoose(row.topicId, e.target.value)}
            >
              {!row.reviewer && <option value="">Chọn giảng viên</option>}
              {row.reviewer && !reviewerKnown && (
                <option value={row.reviewer.id}>
                  {`${row.reviewer.name} (${row.reviewer.code})`}
                </option>
              )}
              {lecturers.map((l) => {
                const isSupervisor = l.id === row.supervisor.id;
                return (
                  <option key={l.id} value={l.id} disabled={isSupervisor}>
                    {isSupervisor
                      ? `${l.name} (${l.code}) (GVHD)`
                      : lecturerLabel(l, projected[l.id] ?? l.reviewCount, max)}
                  </option>
                );
              })}
            </select>
            {row.locked && (
              <span id={`pb-lock-${row.topicId}`} className="rvw-cell-note">
                {row.lockReason}
              </span>
            )}
            {!row.eligible && !row.locked && (
              <span id={`pb-block-${row.topicId}`} className="rvw-cell-note">
                {row.blockedReason}
              </span>
            )}
            {note && (
              <span id={`pb-note-${row.topicId}`} className="rvw-cell-note">
                {`Không gợi ý được: ${note}`}
              </span>
            )}
            {error && (
              <span
                id={`pb-err-${row.topicId}`}
                role="alert"
                className="rvw-cell-error"
              >
                {error}
              </span>
            )}
          </>
        )}
      </td>
      {isViewOnly && (
        <td>
          <Link
            href={`/giao-vu/dot/${encodeURIComponent(roundId)}?tab=danh-gia&muc=phan-bien`}
            className="app-button app-button-small"
          >
            Mở tab Đánh giá
          </Link>
        </td>
      )}
    </tr>
  );
};
