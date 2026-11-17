'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import '@/features/topics/topics.css';
import '@/features/councils/councils.css';
import {
  draftFromCouncil,
  fieldErrors,
  formatDay,
  newDraft,
  slotErrors,
  span,
  toInput,
  type CouncilDraft,
} from '@/features/councils/councilDraft';
import {
  CouncilDetail,
  statusChipClass,
} from '@/features/councils/components/CouncilDetail';
import { CouncilEditor } from '@/features/councils/components/CouncilEditor';
import { CouncilReasonDialog } from '@/features/councils/components/CouncilReasonDialog';
import {
  councilService as defaultCouncilService,
  CouncilConflictError,
  type CouncilService,
} from '@/features/councils/services/councilService';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type { Round } from '@/types/round';
import type { CouncilBoard, CouncilPoolTopic } from '@/types/council';

interface CouncilBoardPageProps {
  service?: CouncilService;
  roundService?: Pick<RoundService, 'list'>;
  // Thời gian chờ trước khi xem trước xung đột khi đang sửa.
  checkDelayMs?: number;
}

type DialogState = 'publish' | 'delete' | 'cancel' | 'correct' | null;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// /giao-vu/hoi-dong: Giáo vụ lập hội đồng (Chủ tịch, Thư ký), đặt ngày, phòng, giờ từng lượt, công bố, sửa/hủy trước
// điểm, đính chính sau điểm (DESIGN/03 · Hội đồng bảo vệ; PDR-014–020, PDR-063).
export const CouncilBoardPage: React.FC<CouncilBoardPageProps> = ({
  service = defaultCouncilService,
  roundService = defaultRoundService,
  checkDelayMs = 400,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const urlRound = searchParams.get('dot') ?? '';

  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState('');
  const [board, setBoard] = useState<CouncilBoard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CouncilDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
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
    // Chỉ chọn đợt mặc định một lần khi tải trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundService]);

  const load = useCallback(
    async (id: string, select?: string | null) => {
      try {
        setError(null);
        const result = await service.board(id);
        setBoard(result);
        setSelectedId((current) => {
          const wanted = select !== undefined ? select : current;
          return result.councils.some((c) => c.id === wanted)
            ? wanted
            : (result.councils[0]?.id ?? null);
        });
      } catch (err: unknown) {
        setError(errorText(err, 'Không tải được danh sách hội đồng.'));
      }
    },
    [service],
  );

  useEffect(() => {
    if (!roundId) return;
    setBoard(null);
    setDraft(null);
    void load(roundId);
  }, [roundId, load]);

  const current = board && board.round.id === roundId ? board : null;
  const selected = current?.councils.find((c) => c.id === selectedId) ?? null;

  // Xem trước xung đột (trùng phòng/giảng viên, GVHD, đề tài đã xếp) trên máy chủ khi bản nháp đủ dữ liệu.
  useEffect(() => {
    if (!draft || !current) return;
    const local = fieldErrors({
      ...draft,
      reason: draft.published ? 'x' : draft.reason,
    });
    if (
      Object.keys(local).length > 0 ||
      Object.keys(slotErrors(draft)).length > 0
    ) {
      setProblems(null);
      return;
    }
    const seq = ++checkSeq.current;
    setChecking(true);
    const timer = setTimeout(() => {
      service
        .check(toInput(draft, current.round.id), draft.id)
        .then((result) => {
          if (seq === checkSeq.current) setProblems(result.problems);
        })
        .catch(() => {
          if (seq === checkSeq.current) setProblems(null);
        })
        .finally(() => {
          if (seq === checkSeq.current) setChecking(false);
        });
    }, checkDelayMs);
    return () => clearTimeout(timer);
  }, [draft, current, service, checkDelayMs]);

  // Kho khi sửa: đề tài đủ điều kiện chưa xếp, cộng đề tài vừa bỏ khỏi chính hội đồng đang sửa.
  const editPool = useMemo<CouncilPoolTopic[]>(() => {
    if (!current || !draft) return [];
    const inDraft = new Set(draft.slots.map((s) => s.topicId));
    const original = current.councils.find((c) => c.id === draft.id);
    const returned: CouncilPoolTopic[] = (original?.slots ?? [])
      .filter((s) => !inDraft.has(s.topicId))
      .map((s) => ({
        topicId: s.topicId,
        code: s.code,
        title: s.title,
        group: s.group,
        supervisor: s.supervisor,
        reviewer: s.reviewer,
        thesisVersionCount: s.thesisVersionCount,
        eligible: true,
        blockedReason: null,
      }));
    return [
      ...current.pool.filter((p) => p.eligible && !inDraft.has(p.topicId)),
      ...returned,
    ].sort((a, b) => a.code.localeCompare(b.code));
  }, [current, draft]);

  const changeRound = (id: string) => {
    setRoundId(id);
    router.replace(`${pathname}?dot=${encodeURIComponent(id)}`);
  };

  const startEdit = (next: CouncilDraft) => {
    setDraft(next);
    setSubmitted(false);
    setProblems(null);
  };

  const save = async () => {
    if (!draft || !current || busy) return;
    setSubmitted(true);
    if (
      Object.keys(fieldErrors(draft)).length > 0 ||
      Object.keys(slotErrors(draft)).length > 0
    )
      return;
    setBusy(true);
    try {
      const input = toInput(draft, current.round.id);
      const saved = draft.id
        ? await service.update(draft.id, input)
        : await service.create(input);
      toast.success(
        saved.status === 'Đã công bố'
          ? `Đã lưu ${saved.name} và gửi thông báo thay đổi lịch cho người bị ảnh hưởng.`
          : `Đã lưu ${saved.name}. Lịch chỉ gửi đi khi bấm “Công bố lịch bảo vệ”.`,
      );
      setDraft(null);
      await load(current.round.id, saved.id);
    } catch (err: unknown) {
      toast.error(errorText(err, 'Không lưu được hội đồng.'));
      if (err instanceof CouncilConflictError) {
        // Lấy lại danh sách xung đột từng dòng để hiện tại chỗ.
        const result = await service
          .check(toInput(draft, current.round.id), draft.id)
          .catch(() => null);
        if (result) setProblems(result.problems);
      }
    } finally {
      setBusy(false);
    }
  };

  const runDialog = async (action: () => Promise<void>) => {
    setBusy(true);
    setDialogError(null);
    try {
      await action();
      setDialog(null);
    } catch (err: unknown) {
      setDialogError(errorText(err, 'Thao tác không thành công. Thử lại sau.'));
    } finally {
      setBusy(false);
    }
  };

  const publish = () =>
    runDialog(async () => {
      if (!current) return;
      const result = await service.publish(current.round.id);
      const failed = result.results.filter((r) => !r.ok);
      if (failed.length === 0)
        toast.success(
          result.published > 0
            ? `Đã công bố lịch bảo vệ của ${result.published} hội đồng; thông báo đã gửi cho hội đồng, GVHD, GVPB và các nhóm.`
            : 'Không có hội đồng Nháp nào để công bố.',
        );
      else
        toast.error(
          `Đã công bố ${result.published} hội đồng; ${failed.length} hội đồng chưa công bố được: ${failed
            .map((f) => `${f.name} (${f.message})`)
            .join('; ')}`,
        );
      await load(current.round.id);
    });

  const remove = () =>
    runDialog(async () => {
      if (!current || !selected) return;
      await service.remove(selected.id);
      toast.success(`Đã xóa ${selected.name}.`);
      await load(current.round.id, null);
    });

  const cancelSchedule = (reason: string) =>
    runDialog(async () => {
      if (!current || !selected) return;
      await service.cancel(selected.id, reason);
      toast.success(
        `Đã hủy lịch ${selected.name} và thông báo cho người bị ảnh hưởng.`,
      );
      await load(current.round.id, selected.id);
    });

  const correct = (content: string, reason: string) =>
    runDialog(async () => {
      if (!current || !selected) return;
      await service.correct(selected.id, content, reason);
      toast.success('Đã ghi đính chính; lịch gốc được giữ nguyên.');
      await load(current.round.id, selected.id);
    });

  if (error && !current)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được hội đồng bảo vệ</h2>
        <p>{error}</p>
      </section>
    );
  if (rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải hội đồng bảo vệ…
      </p>
    );

  const drafts = current?.councils.filter((c) => c.status === 'Nháp') ?? [];
  const editingCouncil = draft
    ? (current?.councils.find((c) => c.id === draft.id) ?? null)
    : null;

  return (
    <div className="cnc-page">
      <div className="app-page-heading">
        <h1>Hội đồng bảo vệ</h1>
        <p>
          Lập hội đồng gồm chủ tịch và thư ký, đặt ngày, phòng, giờ từng lượt và
          xếp thứ tự đề tài bảo vệ. Khi công bố, hệ thống gửi lịch cho hội đồng,
          giảng viên hướng dẫn, phản biện và các nhóm.
        </p>
      </div>

      {rounds.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Chưa có đợt khóa luận nào đã mở để lập hội đồng.</p>
        </section>
      ) : (
        <>
          <div className="cnc-toolbar">
            <div className="tpc-round-row">
              <label htmlFor="hd-round">Đợt</label>
              <select
                id="hd-round"
                className="tpc-select"
                value={roundId}
                disabled={busy || draft !== null}
                onChange={(e) => changeRound(e.target.value)}
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="cnc-spacer" />
            <button
              type="button"
              className="app-button"
              disabled={
                !current ||
                busy ||
                draft !== null ||
                current.round.status !== 'Đang diễn ra'
              }
              onClick={() => current && startEdit(newDraft(current))}
            >
              Tạo hội đồng
            </button>
            <button
              type="button"
              className="app-button app-button-primary"
              disabled={!current || busy || drafts.length === 0}
              aria-describedby={draft ? 'hd-publish-hint' : undefined}
              onClick={() => {
                if (draft) {
                  toast.error(
                    'Lưu hoặc hủy thay đổi của hội đồng đang sửa trước khi công bố.',
                  );
                  return;
                }
                setDialogError(null);
                setDialog('publish');
              }}
            >
              Công bố lịch bảo vệ
            </button>
          </div>
          {draft && (
            <p id="hd-publish-hint" role="note" className="cnc-note">
              Đang sửa {draft.name}: lưu hoặc hủy trước khi công bố hay chuyển
              đợt.
            </p>
          )}

          {!current ? (
            <p role="status" className="app-muted">
              Đang tải danh sách hội đồng…
            </p>
          ) : (
            <>
              <dl className="cnc-stats">
                <div className="app-card">
                  <dt>Hội đồng</dt>
                  <dd>{current.stats.councils}</dd>
                </div>
                <div className="app-card">
                  <dt>Đề tài đã xếp lịch</dt>
                  <dd>{`${current.stats.scheduled}/${current.stats.total}`}</dd>
                </div>
                <div
                  className="app-card"
                  data-tone={current.stats.unscheduled > 0 ? 'warn' : undefined}
                >
                  <dt>Chưa xếp hội đồng</dt>
                  <dd>{current.stats.unscheduled}</dd>
                </div>
                <div
                  className="app-card"
                  data-tone={current.stats.conflicts > 0 ? 'danger' : undefined}
                >
                  <dt>Xung đột</dt>
                  <dd>{current.stats.conflicts}</dd>
                </div>
              </dl>

              <div className="cnc-layout">
                <div
                  className="cnc-list"
                  role="list"
                  aria-label="Danh sách hội đồng"
                >
                  {current.councils.length === 0 && !draft && (
                    <section className="status-state app-empty">
                      <h2>Chưa có hội đồng</h2>
                      <p>
                        Bấm “Tạo hội đồng” để lập hội đồng đầu tiên của đợt.
                      </p>
                    </section>
                  )}
                  {draft && draft.id === null && (
                    <div
                      role="listitem"
                      className="cnc-list-item"
                      aria-current="true"
                    >
                      <span className="cnc-list-head">
                        <span className="cnc-list-name">
                          {draft.name || 'Hội đồng mới'}
                        </span>
                        <span className="app-chip app-chip-pending">
                          Đang tạo
                        </span>
                      </span>
                    </div>
                  )}
                  {current.councils.map((c) => {
                    const isCurrent = draft
                      ? draft.id === c.id
                      : selectedId === c.id;
                    const when = span(c.slots);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="listitem"
                        className="cnc-list-item"
                        aria-current={isCurrent ? 'true' : undefined}
                        disabled={draft !== null && !isCurrent}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <span className="cnc-list-head">
                          <span className="cnc-list-name">{c.name}</span>
                          <span
                            className={
                              draft?.id === c.id
                                ? 'app-chip app-chip-pending'
                                : statusChipClass(c.status)
                            }
                          >
                            {draft?.id === c.id ? 'Đang sửa' : c.status}
                          </span>
                        </span>
                        <span className="cnc-list-meta">{`${formatDay(c.date)} · ${when ?? 'chưa có đề tài'} · ${c.room}`}</span>
                        <span className="cnc-list-meta">{`CT ${c.chair.name} · TK ${c.secretary.name}`}</span>
                        <span className="cnc-list-meta">
                          {`${c.slots.length} đề tài`}
                          {c.conflicts.length > 0 && (
                            <span className="app-chip app-chip-error cnc-list-warn">{`${c.conflicts.length} xung đột`}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <section
                  className="app-card cnc-detail"
                  aria-labelledby="hd-detail-title"
                >
                  {draft ? (
                    <>
                      <div className="cnc-detail-head">
                        <h2 id="hd-detail-title">
                          {draft.id
                            ? `Sửa ${editingCouncil?.name ?? draft.name}`
                            : 'Tạo hội đồng'}
                        </h2>
                      </div>
                      <CouncilEditor
                        draft={draft}
                        board={current}
                        pool={editPool}
                        problems={problems}
                        checking={checking}
                        busy={busy}
                        submitted={submitted}
                        onChange={setDraft}
                        onCancel={() => setDraft(null)}
                        onSave={() => void save()}
                      />
                    </>
                  ) : selected ? (
                    <>
                      <div className="cnc-detail-head">
                        <h2 id="hd-detail-title">{selected.name}</h2>
                        <span className={statusChipClass(selected.status)}>
                          {selected.status}
                        </span>
                      </div>
                      <CouncilDetail
                        council={selected}
                        busy={busy}
                        onEdit={() => startEdit(draftFromCouncil(selected))}
                        onDelete={() => {
                          setDialogError(null);
                          setDialog('delete');
                        }}
                        onCancelSchedule={() => {
                          setDialogError(null);
                          setDialog('cancel');
                        }}
                        onCorrect={() => {
                          setDialogError(null);
                          setDialog('correct');
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <h2 id="hd-detail-title" className="app-visually-hidden">
                        Chi tiết hội đồng
                      </h2>
                      <p className="app-muted">
                        Chọn hoặc tạo một hội đồng để xem chi tiết.
                      </p>
                    </>
                  )}
                </section>
              </div>

              {!draft && (
                <section
                  className="cnc-section"
                  aria-labelledby="hd-pool-title"
                >
                  <h2 id="hd-pool-title">{`Đề tài chưa xếp hội đồng (${current.pool.length})`}</h2>
                  {current.pool.length === 0 ? (
                    <p className="app-muted">
                      Tất cả đề tài của đợt đã có hội đồng.
                    </p>
                  ) : (
                    <ul className="cnc-pool">
                      {current.pool.map((p) => (
                        <li key={p.topicId} className="cnc-pool-item">
                          <div className="cnc-slot-main">
                            <span className="cnc-slot-title">{`${p.code} · ${p.title}`}</span>
                            <span className="cnc-slot-meta">
                              {`HD ${p.supervisor.name} · PB ${p.reviewer?.name ?? 'chưa phân công'} · ${p.thesisVersionCount > 0 ? `đã nộp ${p.thesisVersionCount} bản khóa luận` : 'chưa nộp khóa luận'}`}
                            </span>
                          </div>
                          {p.eligible ? (
                            <span className="app-chip app-chip-active">
                              Đủ điều kiện
                            </span>
                          ) : (
                            <span className="app-chip app-chip-pending">
                              {p.blockedReason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="cnc-hint">
                    Bấm Sửa ở một hội đồng (hoặc Tạo hội đồng) để thêm đề tài
                    vào lịch.
                  </p>
                </section>
              )}

              <p className="cnc-hint">
                Một đề tài chỉ thuộc một hội đồng. Giảng viên không ngồi hội
                đồng chấm đề tài mình hướng dẫn. Hai hội đồng trùng giờ dùng
                chung phòng, hoặc một giảng viên ở hai hội đồng trùng giờ, đều
                không lưu và không công bố được. Sau khi hội đồng có phiếu điểm,
                không sửa giờ, phòng, thành viên hay hủy lịch; chỉ ghi đính
                chính.
              </p>
            </>
          )}
        </>
      )}

      {dialog === 'publish' && current && (
        <ConfirmDialog
          title="Công bố lịch bảo vệ?"
          description={`Công bố ${drafts.length} hội đồng Nháp của đợt (${drafts.map((d) => d.name).join(', ')}). Hệ thống kiểm tra lại xung đột, gửi lịch cho hội đồng, GVHD, GVPB và các nhóm. Hội đồng còn xung đột hoặc chưa có đề tài sẽ được bỏ qua và báo lý do.`}
          cancelLabel="Quay lại"
          confirmLabel="Công bố lịch"
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={() => void publish()}
        />
      )}
      {dialog === 'delete' && selected && (
        <ConfirmDialog
          title={`Xóa ${selected.name}?`}
          description={`${selected.slots.length > 0 ? `${selected.slots.length} đề tài của hội đồng sẽ quay về danh sách chưa xếp hội đồng.` : 'Hội đồng chưa có đề tài nào.'} Chỉ hội đồng Nháp mới xóa được; hội đồng đã công bố được giữ lại để lưu vết.`}
          cancelLabel="Giữ hội đồng"
          confirmLabel="Xóa hội đồng"
          danger
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={() => void remove()}
        />
      )}
      {dialog === 'cancel' && selected && (
        <CouncilReasonDialog
          title={`Hủy lịch ${selected.name}?`}
          description="Lịch không còn hiệu lực nhưng vẫn được giữ trong lịch sử; các đề tài quay về danh sách chưa xếp. Hệ thống thông báo cho hội đồng, GVHD, GVPB và các nhóm."
          cancelLabel="Giữ lịch"
          confirmLabel="Hủy lịch"
          danger
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={({ reason }) => void cancelSchedule(reason)}
        />
      )}
      {dialog === 'correct' && selected && (
        <CouncilReasonDialog
          title={`Ghi đính chính cho ${selected.name}`}
          description="Hội đồng đã có phiếu điểm nên lịch gốc được giữ nguyên. Đính chính hiện cho người có quyền xem lịch và được gửi thông báo."
          withContent
          cancelLabel="Quay lại"
          confirmLabel="Ghi đính chính"
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={({ content, reason }) => void correct(content, reason)}
        />
      )}
    </div>
  );
};
