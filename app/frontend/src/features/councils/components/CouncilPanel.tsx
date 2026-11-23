'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { statusChipClass } from '@/features/councils/components/CouncilDetail';
import { CouncilDrawer } from '@/features/councils/components/CouncilDrawer';
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
import type { Council, CouncilBoard, CouncilPoolTopic } from '@/types/council';

export interface CouncilPanelProps {
  mode?: 'edit' | 'view';
  roundId?: string;
  embedded?: boolean;
  service?: CouncilService;
  roundService?: Pick<RoundService, 'list'>;
  checkDelayMs?: number;
}

type DialogState = 'publish' | 'delete' | 'cancel' | 'correct' | null;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export const CouncilPanel: React.FC<CouncilPanelProps> = ({
  mode = 'edit',
  roundId: propRoundId,
  embedded = false,
  service = defaultCouncilService,
  roundService = defaultRoundService,
  checkDelayMs = 400,
}) => {
  const isViewOnly = mode === 'view';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const urlRound = searchParams?.get('dot') ?? '';

  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState(propRoundId ?? '');
  const [board, setBoard] = useState<CouncilBoard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<CouncilDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
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
    async (id: string, select?: string | null) => {
      try {
        setError(null);
        const next = await service.board(id);
        setBoard(next);
        if (select !== undefined) {
          setSelectedId(select);
        } else {
          setSelectedId((prev) =>
            prev && next.councils.some((c) => c.id === prev) ? prev : null,
          );
        }
      } catch (err: unknown) {
        setError(errorText(err, 'Không tải được danh sách hội đồng.'));
      }
    },
    [service],
  );

  useEffect(() => {
    if (!roundId) return;
    setBoard(null);
    setSelectedId(null);
    setDrawerOpen(false);
    setDraft(null);
    setSubmitted(false);
    setProblems(null);
    void load(roundId);
  }, [roundId, load]);

  const changeRound = (id: string) => {
    setRoundId(id);
    if (!propRoundId) {
      router.replace(`${pathname}?dot=${encodeURIComponent(id)}`);
    }
  };

  const current = board && board.round.id === roundId ? board : null;
  const selected = useMemo<Council | null>(
    () => current?.councils.find((c) => c.id === selectedId) ?? null,
    [current, selectedId],
  );

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
    ];
  }, [current, draft]);

  // Kiểm tra xung đột trước khi lưu
  useEffect(() => {
    setProblems(null);
    setChecking(false);
    if (!draft || !current || isViewOnly) return;
    const local = fieldErrors({
      ...draft,
      reason: draft.published ? 'tam' : '',
    });
    if (Object.keys(local).length > 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const input = toInput(draft, current.round.id);
        const result = await service.check(input, draft.id);
        if (!cancelled) setProblems(result.problems);
      } catch {
        if (!cancelled) setProblems(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, checkDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, current, service, checkDelayMs, isViewOnly]);

  const openDrawerForView = (c: Council) => {
    setSelectedId(c.id);
    setDraft(null);
    setDrawerOpen(true);
  };

  const openDrawerForCreate = () => {
    if (!current || isViewOnly) return;
    setSelectedId(null);
    setDraft(newDraft(current));
    setSubmitted(false);
    setProblems(null);
    setDrawerOpen(true);
  };

  const startEdit = (next: CouncilDraft) => {
    if (isViewOnly) return;
    setDraft(next);
    setSubmitted(false);
    setProblems(null);
  };

  const save = async () => {
    if (!draft || !current || busy || isViewOnly) return;
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
      if (!current || isViewOnly) return;
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
      if (!current || !selected || isViewOnly) return;
      await service.remove(selected.id);
      toast.success(`Đã xóa ${selected.name}.`);
      setDrawerOpen(false);
      await load(current.round.id, null);
    });

  const cancelSchedule = (reason: string) =>
    runDialog(async () => {
      if (!current || !selected || isViewOnly) return;
      await service.cancel(selected.id, reason);
      toast.success(
        `Đã hủy lịch ${selected.name} và thông báo cho người bị ảnh hưởng.`,
      );
      await load(current.round.id, selected.id);
    });

  const correct = (content: string, reason: string) =>
    runDialog(async () => {
      if (!current || !selected || isViewOnly) return;
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

  if (!propRoundId && rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải hội đồng bảo vệ…
      </p>
    );

  const drafts = current?.councils.filter((c) => c.status === 'Nháp') ?? [];

  return (
    <div className="cnc-page">
      {!embedded && (
        <div className="app-page-heading">
          <h1>Hội đồng bảo vệ</h1>
          <p>
            {isViewOnly
              ? 'Xem danh sách và lịch của các hội đồng bảo vệ khóa luận. Để tạo hoặc sửa hội đồng, mở tab Đánh giá trong chi tiết đợt.'
              : 'Lập hội đồng gồm chủ tịch và thư ký, đặt ngày, phòng, giờ từng lượt và xếp thứ tự đề tài bảo vệ. Khi công bố, hệ thống gửi lịch cho hội đồng, GVHD, GVPB và các nhóm.'}
          </p>
        </div>
      )}

      {!propRoundId && rounds && rounds.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>Chưa có đợt khóa luận nào đã mở để lập hội đồng.</p>
        </section>
      ) : (
        <>
          <div className="cnc-toolbar">
            {!propRoundId && rounds && (
              <div className="tpc-round-row">
                <label htmlFor="hd-round">Đợt</label>
                <select
                  id="hd-round"
                  className="tpc-select"
                  value={roundId}
                  disabled={busy}
                  onChange={(e) => changeRound(e.target.value)}
                >
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="cnc-spacer" />
            {!isViewOnly && (
              <>
                <button
                  type="button"
                  className="app-button"
                  disabled={
                    !current || busy || current.round.status !== 'Đang diễn ra'
                  }
                  onClick={openDrawerForCreate}
                >
                  Tạo hội đồng
                </button>
                <button
                  type="button"
                  className="app-button app-button-primary"
                  disabled={!current || busy || drafts.length === 0}
                  onClick={() => {
                    setDialogError(null);
                    setDialog('publish');
                  }}
                >
                  Công bố lịch bảo vệ
                </button>
              </>
            )}
          </div>

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

              {current.councils.length === 0 ? (
                <section className="status-state app-empty">
                  <h2>Chưa có hội đồng</h2>
                  <p>
                    {isViewOnly
                      ? 'Đợt này chưa có hội đồng bảo vệ nào.'
                      : 'Bấm “Tạo hội đồng” để lập hội đồng đầu tiên của đợt.'}
                  </p>
                </section>
              ) : (
                <div
                  className="app-card app-table-scroll"
                  role="region"
                  aria-label="Danh sách hội đồng"
                >
                  <table className="app-table" aria-label="Danh sách hội đồng">
                    <thead>
                      <tr>
                        <th scope="col">Tên hội đồng</th>
                        <th scope="col">Ngày & Giờ</th>
                        <th scope="col">Phòng</th>
                        <th scope="col">Chủ tịch</th>
                        <th scope="col">Thư ký</th>
                        <th scope="col">Số đề tài</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">
                          <span className="app-visually-hidden">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.councils.map((c) => {
                        const when = span(c.slots);
                        return (
                          <tr
                            key={c.id}
                            className="rnd-clickable-row"
                            onClick={() => openDrawerForView(c)}
                          >
                            <td>
                              <b>{c.name}</b>
                              {c.conflicts.length > 0 && (
                                <div>
                                  <span className="app-chip app-chip-error cnc-list-warn">
                                    {`${c.conflicts.length} xung đột`}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <span>{`${formatDay(c.date)} · ${when ?? 'chưa có đề tài'} · ${c.room}`}</span>
                            </td>
                            <td>{c.room || '—'}</td>
                            <td>{`CT ${c.chair.name}`}</td>
                            <td>{`TK ${c.secretary.name}`}</td>
                            <td>{`${c.slots.length} đề tài`}</td>
                            <td>
                              <span className={statusChipClass(c.status)}>
                                {c.status}
                              </span>
                            </td>
                            <td>
                              {isViewOnly ? (
                                <Link
                                  href={`/giao-vu/dot/${encodeURIComponent(roundId)}?tab=danh-gia&muc=hoi-dong`}
                                  className="app-button app-button-small"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Mở tab Đánh giá
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="app-button app-button-small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDrawerForView(c);
                                  }}
                                >
                                  Chi tiết
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {current.pool.length > 0 && (
                <section
                  className="app-card cnc-pool-section rnd-mt-4"
                  aria-labelledby="hd-pool-title"
                >
                  <h3 id="hd-pool-title" className="rnd-section-title">
                    {`Kho đề tài chưa xếp (${current.pool.length})`}
                  </h3>
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
                </section>
              )}
            </>
          )}
        </>
      )}

      {drawerOpen && current && (
        <CouncilDrawer
          council={selected}
          draft={draft}
          board={current}
          pool={editPool}
          problems={problems}
          checking={checking}
          busy={busy}
          submitted={submitted}
          readOnly={isViewOnly}
          onClose={() => {
            setDrawerOpen(false);
            setDraft(null);
          }}
          onEdit={() => selected && startEdit(draftFromCouncil(selected))}
          onCancelEdit={() => {
            if (draft?.id === null) {
              setDrawerOpen(false);
            }
            setDraft(null);
          }}
          onChangeDraft={setDraft}
          onSaveDraft={() => void save()}
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
      )}

      {dialog === 'publish' && (
        <ConfirmDialog
          title="Công bố lịch bảo vệ?"
          description={`Công bố ${drafts.length} hội đồng Nháp của đợt (${drafts.map((d) => d.name).join(', ')}). Hệ thống kiểm tra lại xung đột, gửi lịch cho hội đồng, GVHD, GVPB và các nhóm.`}
          cancelLabel="Hủy"
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
          cancelLabel="Hủy"
          confirmLabel="Xóa hội đồng"
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
