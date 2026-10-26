'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { RoundService } from '@/features/rounds/services/roundService';
import type {
  Candidate,
  ParticipantCheck,
  ParticipantKind,
  Round,
} from '@/types/round';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface AddParticipantsDialogProps {
  kind: ParticipantKind;
  round: Round;
  roundService: RoundService;
  onClose: () => void;
  onAdded: (round: Round, added: number) => void;
}

type Mode = 'pick' | 'codes';

const LABEL: Record<ParticipantKind, string> = {
  lecturer: 'giảng viên',
  student: 'sinh viên',
};

const CHECK_LABEL: Record<ParticipantCheck['status'], string> = {
  valid: 'Hợp lệ',
  notFound: 'Không tồn tại',
  alreadyInRound: 'Đã trong đợt',
  inOtherRound: 'SV đang ở đợt khác',
};

const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

// Thêm giảng viên / sinh viên vào đợt: chọn từ danh sách hoặc nhập mã; nhập mã
// có bước "Kiểm tra" từng mã trước khi thêm (03: Chi tiết đợt).
export const AddParticipantsDialog: React.FC<AddParticipantsDialogProps> = ({
  kind,
  round,
  roundService,
  onClose,
  onAdded,
}) => {
  const [mode, setMode] = useState<Mode>('pick');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [codesText, setCodesText] = useState('');
  const [results, setResults] = useState<ParticipantCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const validResults = (results ?? []).filter((r) => r.status === 'valid');
  const codesToAdd =
    mode === 'pick'
      ? (candidates ?? [])
          .filter((c) => selected.includes(c.id))
          .map((c) => c.code)
      : validResults.map((r) => r.code);

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

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const toggle = (id: string) =>
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-participants-title"
        className="dialog dialog-medium"
      >
        <div className="login-form">
          <div className="login-heading">
            <h2 id="add-participants-title">Thêm {LABEL[kind]}</h2>
            <p>
              {kind === 'student'
                ? 'Một sinh viên chỉ thuộc một đợt đang diễn ra.'
                : 'Giảng viên có thể thuộc nhiều đợt.'}
            </p>
          </div>

          <div className="app-segmented" role="group" aria-label="Cách thêm">
            <button
              type="button"
              aria-pressed={mode === 'pick'}
              onClick={() => switchMode('pick')}
            >
              Chọn từ danh sách
            </button>
            <button
              type="button"
              aria-pressed={mode === 'codes'}
              onClick={() => switchMode('codes')}
            >
              Nhập mã
            </button>
          </div>

          {error && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'pick' ? (
            candidates === null ? (
              <p role="status" className="app-muted">
                Đang tải danh sách...
              </p>
            ) : candidates.length === 0 ? (
              <p className="app-muted">
                Mọi {LABEL[kind]} đã có trong đợt này.
              </p>
            ) : (
              <fieldset className="app-choice-group app-pick-list">
                <legend>Chọn {LABEL[kind]}</legend>
                {candidates.map((c) => (
                  <label key={c.id} className="app-choice">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      disabled={!!c.blockedReason}
                      onChange={() => toggle(c.id)}
                    />
                    <span>
                      {c.code} · {c.name}
                      <span className="app-muted"> · {c.unit}</span>
                      {c.blockedReason && (
                        <span className="app-pick-blocked">
                          {' '}
                          — {c.blockedReason}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )
          ) : (
            <>
              <div className="login-field">
                <label htmlFor="participant-codes">
                  Mã {LABEL[kind]} (mỗi dòng một mã, hoặc ngăn cách bằng dấu
                  phẩy)
                </label>
                <textarea
                  id="participant-codes"
                  rows={4}
                  value={codesText}
                  onChange={(e) => {
                    setCodesText(e.target.value);
                    setResults(null);
                    setError(null);
                  }}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="app-button"
                  disabled={busy}
                  onClick={() => void check()}
                >
                  Kiểm tra
                </button>
              </div>
              {results && (
                <ul className="app-check-results" aria-label="Kết quả kiểm tra">
                  {results.map((r) => (
                    <li key={r.code}>
                      <strong>{r.code}</strong>
                      <span
                        className={
                          r.status === 'valid'
                            ? 'app-chip app-chip-active'
                            : 'app-chip app-chip-error'
                        }
                      >
                        {CHECK_LABEL[r.status]}
                      </span>
                      <span className="app-muted">
                        {r.participant ? `${r.participant.name}. ` : ''}
                        {r.status === 'valid' ? '' : r.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="dialog-actions dialog-actions-split">
            <button
              type="button"
              className="app-button"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="button"
              className="app-button app-button-primary"
              disabled={busy || codesToAdd.length === 0}
              aria-busy={busy}
              onClick={() => void add()}
            >
              Thêm {codesToAdd.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
