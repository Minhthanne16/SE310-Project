'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import '@/features/rounds/rounds.css';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import { studentNoun } from '@/features/rounds/roundUtils';
import type { RoundService } from '@/features/rounds/services/roundService';
import type {
  Candidate,
  ParticipantCheck,
  ParticipantKind,
  Round,
} from '@/types/round';

export type AddMode = 'pick' | 'codes';

interface AddParticipantsDialogProps {
  kind: ParticipantKind;
  round: Round;
  roundService: RoundService;
  initialMode?: AddMode;
  onClose: () => void;
  onAdded: (round: Round, added: number) => void;
}

// Nhãn và màu chip kết quả kiểm tra từng mã (artboard: Sẽ thêm / Bỏ qua /
// Không có trong hệ thống / Đang ở đợt khác).
const CHECK_VIEW: Record<
  ParticipantCheck['status'],
  { label: string; pill: string }
> = {
  valid: { label: 'Sẽ thêm', pill: 'rnd-pill-ok' },
  alreadyInRound: { label: 'Bỏ qua', pill: 'rnd-pill-neutral' },
  notFound: { label: 'Không có trong hệ thống', pill: 'rnd-pill-bad' },
  inOtherRound: { label: 'Đang ở đợt khác', pill: 'rnd-pill-bad' },
};
const SUMMARY_ORDER: ParticipantCheck['status'][] = [
  'valid',
  'notFound',
  'inOtherRound',
  'alreadyInRound',
];

const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

// Thêm giảng viên / sinh viên vào đợt (artboard GiaoVu-DotKhoaLuan): chọn từ
// danh sách hoặc nhập mã; nhập mã có bước kiểm tra từng mã trước khi thêm.
export const AddParticipantsDialog: React.FC<AddParticipantsDialogProps> = ({
  kind,
  round,
  roundService,
  initialMode = 'pick',
  onClose,
  onAdded,
}) => {
  const who = kind === 'lecturer' ? 'giảng viên' : studentNoun(round.program);
  const unitLabel = kind === 'lecturer' ? 'Bộ môn' : 'Lớp';

  const [mode, setMode] = useState<AddMode>(initialMode);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [codesText, setCodesText] = useState('');
  const [results, setResults] = useState<ParticipantCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    roundService
      .listCandidates(round.id, kind)
      .then((list) => !cancelled && setCandidates(list))
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được danh sách.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [roundService, round.id, kind]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Thao tác thất bại. Thử lại sau.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const keyword = search.trim().toLowerCase();
  const units = Array.from(new Set((candidates ?? []).map((c) => c.unit)));
  const shown = (candidates ?? []).filter(
    (c) =>
      (!onlyFree || !c.blockedReason) &&
      (!unit || c.unit === unit) &&
      (!keyword ||
        c.code.toLowerCase().includes(keyword) ||
        c.name.toLowerCase().includes(keyword) ||
        c.unit.toLowerCase().includes(keyword)),
  );
  const freeIds = (candidates ?? [])
    .filter((c) => !c.blockedReason)
    .map((c) => c.id);
  const shownFreeIds = shown.filter((c) => !c.blockedReason).map((c) => c.id);
  const allOn =
    shownFreeIds.length > 0 &&
    shownFreeIds.every((id) => selected.includes(id));
  const pickedIds = selected.filter((id) => freeIds.includes(id));

  const validResults = (results ?? []).filter((r) => r.status === 'valid');
  const previewing = mode === 'codes' && results !== null;
  const codesToAdd =
    mode === 'pick'
      ? (candidates ?? [])
          .filter((c) => pickedIds.includes(c.id))
          .map((c) => c.code)
      : validResults.map((r) => r.code);
  const count = codesToAdd.length;

  const check = () =>
    run(async () => {
      const codes = splitCodes(codesText);
      if (codes.length === 0) {
        setResults(null);
        setError('Nhập ít nhất một mã.');
        return;
      }
      setResults(await roundService.checkParticipants(round.id, kind, codes));
    });

  const add = () =>
    run(async () => {
      const outcome = await roundService.addParticipants(
        round.id,
        kind,
        codesToAdd,
      );
      if (outcome.added === 0) {
        setResults(outcome.results);
        setError('Không thêm được mã nào. Xem kết quả từng mã.');
        return;
      }
      onAdded(outcome.round, outcome.added);
    });

  const switchMode = (next: AddMode) => {
    setMode(next);
    setError(null);
  };

  const toggle = (id: string) =>
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );

  const goLabel =
    mode === 'pick'
      ? count > 0
        ? `Thêm ${count} ${who}`
        : 'Thêm vào đợt'
      : previewing
        ? `Thêm ${count} ${who} hợp lệ`
        : 'Kiểm tra danh sách';
  const goDisabled =
    busy || (mode === 'pick' || previewing ? count === 0 : false);
  const onGo = () => {
    if (goDisabled) return;
    if (mode === 'codes' && !previewing) void check();
    else void add();
  };

  const footText =
    mode === 'pick'
      ? `${count > 0 ? `Đã chọn ${count} ${who}.` : 'Chưa chọn ai.'} Không thấy người cần thêm?`
      : 'Mã chưa có tài khoản sẽ bị bỏ qua.';

  const modes: { id: AddMode; label: string }[] = [
    { id: 'pick', label: 'Chọn từ danh sách người dùng' },
    { id: 'codes', label: 'Nhập theo mã (dán danh sách)' },
  ];

  return (
    <RoundModal
      titleId="add-participants-title"
      size="wide"
      busy={busy}
      onClose={onClose}
    >
      <div className="rnd-add-head">
        <div className="rnd-add-head-row">
          <div>
            <h2 id="add-participants-title">Thêm {who} vào đợt</h2>
            <span className="rnd-modal-sub">
              {round.name} · {who} phải có tài khoản trong hệ thống trước
            </span>
          </div>
          <button
            type="button"
            className="rnd-close"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div role="tablist" aria-label="Cách thêm" className="rnd-modes">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              id={`add-mode-${m.id}`}
              aria-selected={mode === m.id}
              aria-controls="add-mode-panel"
              className="rnd-mode"
              onClick={() => switchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="add-mode-panel"
        aria-labelledby={`add-mode-${mode}`}
        className="rnd-add-body"
      >
        {error && (
          <p role="alert" className="rnd-note rnd-note-bad">
            {error}
          </p>
        )}

        {mode === 'pick' &&
          (candidates === null ? (
            <p role="status" className="rnd-hint">
              Đang tải danh sách...
            </p>
          ) : candidates.length === 0 ? (
            <p className="rnd-hint">Mọi {who} đã có trong đợt này.</p>
          ) : (
            <>
              <div className="rnd-add-tools">
                <div className="rnd-add-search">
                  <Search size={18} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Tìm người dùng"
                    placeholder={
                      kind === 'lecturer'
                        ? 'Tìm theo tên, mã giảng viên, bộ môn'
                        : 'Tìm theo mã, họ tên, lớp'
                    }
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rnd-select"
                  aria-label={unitLabel}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="">
                    {kind === 'lecturer' ? 'Tất cả bộ môn' : 'Tất cả lớp'}
                  </option>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <label className="rnd-check-inline">
                  <input
                    type="checkbox"
                    checked={onlyFree}
                    onChange={(e) => setOnlyFree(e.target.checked)}
                  />
                  Chỉ hiện người thêm được
                </label>
              </div>
              <div className="rnd-pick" role="group" aria-label={`Chọn ${who}`}>
                <div className="rnd-pick-head">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả người thêm được"
                    checked={allOn}
                    disabled={shownFreeIds.length === 0}
                    onChange={() =>
                      setSelected((list) =>
                        allOn
                          ? list.filter((id) => !shownFreeIds.includes(id))
                          : Array.from(new Set([...list, ...shownFreeIds])),
                      )
                    }
                  />
                  <span>
                    {kind === 'lecturer'
                      ? 'Giảng viên'
                      : who === 'học viên'
                        ? 'Học viên'
                        : 'Sinh viên'}
                  </span>
                  <span>{unitLabel}</span>
                  <span>Trạng thái</span>
                </div>
                {shown.length === 0 && (
                  <p className="rnd-hint" style={{ padding: '12px 14px' }}>
                    Không có người phù hợp bộ lọc.
                  </p>
                )}
                {shown.map((c) => {
                  const blocked = !!c.blockedReason;
                  const on = !blocked && selected.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`rnd-pick-row${on ? ' rnd-pick-row-on' : ''}${blocked ? ' rnd-pick-row-off' : ''}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${c.name} (${c.code})`}
                        checked={on}
                        disabled={blocked}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="rnd-pick-name">
                        <b>{c.name}</b>
                        <span>{c.code}</span>
                      </span>
                      <span>{c.unit}</span>
                      <span className="rnd-pick-status">
                        <span
                          className={`rnd-pill rnd-pill-sm ${blocked ? 'rnd-pill-bad' : 'rnd-pill-ok'}`}
                        >
                          {blocked ? 'Không thêm được' : 'Có thể thêm'}
                        </span>
                        {blocked && <small>{c.blockedReason}</small>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ))}

        {mode === 'codes' && !previewing && (
          <>
            <label
              htmlFor="participant-codes"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Dán mã {who}, mỗi dòng một người (hoặc ngăn cách bằng dấu phẩy)
            </label>
            <textarea
              id="participant-codes"
              className="rnd-textarea"
              rows={9}
              value={codesText}
              onChange={(e) => {
                setCodesText(e.target.value);
                setError(null);
              }}
            />
          </>
        )}

        {previewing && results && (
          <>
            <div className="rnd-sums" aria-label="Tóm tắt kiểm tra">
              {SUMMARY_ORDER.filter((s) =>
                results.some((r) => r.status === s),
              ).map((s) => (
                <span key={s} className={`rnd-sum ${CHECK_VIEW[s].pill}`}>
                  {results.filter((r) => r.status === s).length}{' '}
                  {CHECK_VIEW[s].label.toLowerCase()}
                </span>
              ))}
            </div>
            <div className="rnd-prev">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dòng</th>
                    <th scope="col">Mã</th>
                    <th scope="col">Họ tên</th>
                    <th scope="col">Kết quả</th>
                  </tr>
                </thead>
                <tbody aria-label="Kết quả kiểm tra">
                  {results.map((r, i) => (
                    <tr key={r.code}>
                      <td>{i + 1}</td>
                      <td>{r.code}</td>
                      <td>
                        <b style={{ fontWeight: 600 }}>
                          {r.participant?.name ?? '—'}
                        </b>
                      </td>
                      <td>
                        <span className="rnd-pick-status">
                          <span
                            className={`rnd-pill rnd-pill-sm ${CHECK_VIEW[r.status].pill}`}
                          >
                            {CHECK_VIEW[r.status].label}
                          </span>
                          {r.status !== 'valid' && <small>{r.message}</small>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="rnd-hint">
              Chỉ thêm các dòng <b>Sẽ thêm</b>; các dòng khác bỏ qua, không làm
              hỏng cả danh sách. Mã chưa có tài khoản cần tạo ở{' '}
              <Link className="rnd-link" href="/giao-vu/nguoi-dung">
                Người dùng
              </Link>{' '}
              rồi nhập lại.
            </span>
          </>
        )}
      </div>

      <div className="rnd-add-foot">
        <span>
          {footText}{' '}
          <Link className="rnd-link" href="/giao-vu/nguoi-dung">
            Tạo ở trang Người dùng
          </Link>
        </span>
        <span className="rnd-add-foot-actions">
          <button
            type="button"
            className="rnd-btn"
            disabled={busy}
            onClick={() => (previewing ? setResults(null) : onClose())}
          >
            {previewing ? 'Sửa danh sách' : 'Hủy'}
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-primary"
            disabled={goDisabled}
            aria-busy={busy}
            onClick={onGo}
          >
            {goLabel}
          </button>
        </span>
      </div>
    </RoundModal>
  );
};
