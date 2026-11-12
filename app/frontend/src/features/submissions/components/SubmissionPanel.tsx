'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '@/api/request';
import {
  submissionService as defaultService,
  type SubmissionService,
} from '@/features/submissions/services/submissionApiService';
import {
  MAX_NOTE_LENGTH,
  NOTE_REQUIRED_MESSAGE,
  WINDOW_LABELS,
  deadlineText,
  fileError,
  formatBytes,
  formatSubmittedAt,
} from '@/features/submissions/submissionUtils';
import type {
  SubmissionKindState,
  TopicSubmissions,
} from '@/types/submission';
import '@/features/submissions/submissions.css';

interface SubmissionPanelProps {
  topicId: string;
  service?: SubmissionService;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: TopicSubmissions };

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

// Báo cáo giữa kỳ/cuối kỳ của một đề tài (P04-S02): thành viên nhóm nộp PDF,
// người có quyền xem tải lại mọi phiên bản. Quyền và hạn do backend quyết định.
export const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  topicId,
  service = defaultService,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', data: await service.list(topicId) });
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: errorText(err, 'Không tải được danh sách bài nộp.'),
      });
    }
  }, [service, topicId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading')
    return (
      <p className="sub-muted" role="status">
        Đang tải bài nộp…
      </p>
    );
  if (state.kind === 'error')
    return (
      <div className="sub-banner sub-banner-bad" role="alert">
        <span>{state.message}</span>
        <button type="button" className="sub-btn" onClick={() => void load()}>
          Thử lại
        </button>
      </div>
    );

  return (
    <div className="sub-panel">
      {state.data.kinds.map((kind) => (
        <KindSection
          key={kind.kind}
          kind={kind}
          maxBytes={state.data.maxBytes}
          onSubmit={(file, note) =>
            service.submit(topicId, kind.kind, file, note)
          }
          onSubmitted={(data) => setState({ kind: 'ready', data })}
        />
      ))}
    </div>
  );
};

interface KindSectionProps {
  kind: SubmissionKindState;
  maxBytes: number;
  onSubmit: (file: File, note: string) => Promise<TopicSubmissions>;
  onSubmitted: (data: TopicSubmissions) => void;
}

const KindSection: React.FC<KindSectionProps> = ({
  kind,
  maxBytes,
  onSubmit,
  onSubmitted,
}) => {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [noteProblem, setNoteProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const pick = (next: File | null) => {
    setFile(next);
    setFileProblem(next ? fileError(next, maxBytes) : null);
    setFailure(null);
    setDone(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const fileIssue = fileError(file, maxBytes);
    const noteIssue =
      kind.noteRequired && !note.trim() ? NOTE_REQUIRED_MESSAGE : null;
    setFileProblem(fileIssue);
    setNoteProblem(noteIssue);
    if (fileIssue || noteIssue || !file) return;

    setSending(true);
    setFailure(null);
    setDone(null);
    try {
      const data = await onSubmit(file, note);
      const latest = data.kinds.find((k) => k.kind === kind.kind)?.versions[0];
      setFile(null);
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
      setDone(
        latest
          ? `Đã nộp bản ${latest.version}${latest.isLate ? ' (nộp trễ)' : ''}.`
          : 'Đã nộp.',
      );
      onSubmitted(data);
    } catch (err: unknown) {
      // Không báo thành công khi chưa lưu được; tệp đã chọn được giữ để thử lại.
      setFailure(errorText(err, 'Chưa nộp được. Thử lại sau.'));
    } finally {
      setSending(false);
    }
  };

  const chipClass =
    kind.window === 'onTime'
      ? 'sub-chip sub-chip-ok'
      : kind.window === 'late'
        ? 'sub-chip sub-chip-warn'
        : 'sub-chip';

  return (
    <section className="sub-kind" aria-labelledby={`${id}-title`}>
      <header className="sub-kind-head">
        <h2 id={`${id}-title`}>{kind.name}</h2>
        <span className={chipClass}>{WINDOW_LABELS[kind.window]}</span>
        <span className="sub-chip">
          {kind.versions.length === 0
            ? 'Chưa nộp'
            : `${kind.versions.length} phiên bản`}
        </span>
      </header>
      <p className="sub-muted">{deadlineText(kind)}</p>

      {kind.canSubmit ? (
        <form className="sub-form" onSubmit={submit} noValidate>
          {kind.window === 'late' ? (
            <p className="sub-banner sub-banner-warn">
              Đã qua hạn thường. Bài nộp bây giờ sẽ được gắn nhãn “Nộp trễ”.
            </p>
          ) : null}
          <div className="sub-field">
            <label htmlFor={`${id}-file`}>Tệp báo cáo (PDF, tối đa 20 MB)</label>
            <input
              ref={fileInput}
              id={`${id}-file`}
              type="file"
              accept="application/pdf,.pdf"
              disabled={sending}
              aria-invalid={fileProblem ? true : undefined}
              aria-describedby={fileProblem ? `${id}-file-error` : undefined}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file && !fileProblem ? (
              <span className="sub-muted">
                {file.name} · {formatBytes(file.size)}
              </span>
            ) : null}
            {fileProblem ? (
              <span id={`${id}-file-error`} className="sub-error" role="alert">
                {fileProblem}
              </span>
            ) : null}
          </div>
          <div className="sub-field">
            <label htmlFor={`${id}-note`}>
              Ghi chú thay đổi
              {kind.noteRequired ? ' (bắt buộc)' : ' (không bắt buộc)'}
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              value={note}
              disabled={sending}
              aria-invalid={noteProblem ? true : undefined}
              aria-describedby={noteProblem ? `${id}-note-error` : undefined}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteProblem(null);
              }}
            />
            {noteProblem ? (
              <span id={`${id}-note-error`} className="sub-error" role="alert">
                {noteProblem}
              </span>
            ) : null}
          </div>
          {failure ? (
            <p className="sub-banner sub-banner-bad" role="alert">
              {failure}
            </p>
          ) : null}
          <div>
            <button
              type="submit"
              className="sub-btn sub-btn-primary"
              disabled={sending}
            >
              {sending
                ? 'Đang nộp…'
                : kind.versions.length > 0
                  ? `Nộp bản mới ${kind.name.toLowerCase()}`
                  : `Nộp ${kind.name.toLowerCase()}`}
            </button>
          </div>
        </form>
      ) : kind.blockedReason ? (
        <p className="sub-banner">{kind.blockedReason}</p>
      ) : null}

      {done ? (
        <p className="sub-banner sub-banner-ok" role="status">
          {done}
        </p>
      ) : null}

      {kind.versions.length === 0 ? (
        <p className="sub-empty">Chưa có bản nào được nộp.</p>
      ) : (
        <ul className="sub-versions" aria-label={`Các phiên bản ${kind.name}`}>
          {kind.versions.map((v) => (
            <li key={v.id} className="sub-version">
              <div className="sub-version-main">
                <strong>Bản {v.version}</strong>
                {v.isLatest ? (
                  <span className="sub-chip sub-chip-info">Mới nhất</span>
                ) : null}
                {v.isLate ? (
                  <span className="sub-chip sub-chip-warn">Nộp trễ</span>
                ) : null}
                <span className="sub-file">{v.fileName}</span>
                <span className="sub-muted">{formatBytes(v.sizeBytes)}</span>
              </div>
              <div className="sub-muted">
                {v.submittedBy.name} ({v.submittedBy.code}) nộp lúc{' '}
                {formatSubmittedAt(v.submittedAt)}
              </div>
              {v.note ? <div className="sub-note">{v.note}</div> : null}
              <a
                className="sub-btn"
                href={v.downloadUrl}
                download={v.fileName}
                aria-label={`Tải bản ${v.version} ${kind.name}`}
              >
                Tải
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
