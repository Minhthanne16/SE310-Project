'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileText } from 'lucide-react';
import '@/features/rounds/rounds.css';
import '@/features/outline/outline.css';
import { formatDate, formatDateTime } from '@/features/rounds/roundUtils';
import {
  OutlineNotFoundError,
  outlineFileError,
  outlineFileUrl,
  outlineService as defaultService,
  type OutlineService,
} from '@/features/outline/services/outlineService';
import type {
  Outline,
  OutlineSubmission,
  RevisionRequest,
} from '@/types/outline';

// Chặng Đề cương trong Không gian đề tài (P04-S01, PDR-013): nhóm nộp phiên bản,
// GVHD nhận xét, tạo/đóng yêu cầu chỉnh sửa và duyệt; Giáo vụ chỉ xem.
interface OutlineSectionProps {
  topicId: string;
  service?: OutlineService;
  // Báo cho trang cha mỗi khi có dữ liệu đề cương (lúc tải và sau mỗi thao tác).
  onReady?: (outline: Outline) => void;
}

const MAX_TEXT = 2000;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const shortDate = (iso: string) => formatDateTime(iso).slice(0, 5);

interface Stage {
  text: string;
  chip: string;
}

// Trạng thái chặng: ai đang giữ lượt tiếp theo.
export function outlineStage(outline: Outline): Stage {
  const open = outline.requests.filter((r) => r.status === 'open').length;
  if (outline.approvedAt)
    return {
      text: outline.approvedVersionNo
        ? `Đã duyệt Lần ${outline.approvedVersionNo} · ${shortDate(outline.approvedAt)}`
        : `Đã duyệt · ${shortDate(outline.approvedAt)}`,
      chip: 'app-chip-active',
    };
  if (outline.submissions.length === 0)
    return { text: 'Chưa nộp', chip: 'app-chip-disabled' };
  const latest = outline.submissions[0];
  const waitingGroup = outline.requests.some(
    (r) => r.status === 'open' && r.raisedOnVersionNo >= latest.versionNo,
  );
  if (waitingGroup)
    return {
      text: `Chờ nhóm sửa · ${open} yêu cầu mở`,
      chip: 'app-chip-pending',
    };
  return {
    text: `Chờ GVHD xem Lần ${latest.versionNo}`,
    chip: 'app-chip-info',
  };
}

// ---------- Nộp phiên bản (sinh viên) ----------

const SubmitForm: React.FC<{
  outline: Outline;
  busy: boolean;
  onSubmit: (file: File, note: string) => Promise<boolean>;
}> = ({ outline, busy, onSubmit }) => {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const open = outline.requests.filter((r) => r.status === 'open').length;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = outlineFileError(file);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    if (await onSubmit(file as File, note)) {
      setFile(null);
      setNote('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <form
      className="otl-form"
      onSubmit={handle}
      noValidate
      aria-label="Nộp đề cương"
    >
      <h3 className="otl-subtitle">
        {outline.submissions.length === 0
          ? 'Nộp đề cương'
          : `Nộp phiên bản mới (Lần ${outline.submissions[0].versionNo + 1})`}
      </h3>
      {open > 0 && (
        <p className="rnd-note rnd-note-warn" role="note">
          {`Phiên bản mới xử lý cho cả ${open} yêu cầu đang mở; GVHD sẽ kiểm tra và đóng từng yêu cầu.`}
        </p>
      )}
      <div className="otl-field">
        <label className="rnd-label" htmlFor={`${ids}-file`}>
          Tệp PDF (tối đa 20 MB)
        </label>
        <input
          ref={inputRef}
          id={`${ids}-file`}
          type="file"
          accept="application/pdf,.pdf"
          className="rnd-input otl-file"
          aria-invalid={!!error}
          aria-describedby={error ? `${ids}-file-error` : undefined}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        {error && (
          <p id={`${ids}-file-error`} role="alert" className="rnd-field-err">
            {error}
          </p>
        )}
      </div>
      <div className="otl-field">
        <label className="rnd-label" htmlFor={`${ids}-note`}>
          Ghi chú thay đổi (không bắt buộc)
        </label>
        <textarea
          id={`${ids}-note`}
          className="rnd-textarea"
          rows={3}
          maxLength={MAX_TEXT}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="otl-actions">
        <button
          type="submit"
          className="app-button app-button-primary"
          disabled={busy}
        >
          {busy ? 'Đang nộp…' : 'Nộp đề cương'}
        </button>
      </div>
    </form>
  );
};

// ---------- Yêu cầu chỉnh sửa ----------

const RequestForm: React.FC<{
  busy: boolean;
  onCreate: (content: string) => Promise<boolean>;
}> = ({ busy, onCreate }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Nhập nội dung yêu cầu chỉnh sửa.');
      return;
    }
    if (await onCreate(content)) setContent('');
  };

  return (
    <form
      className="otl-form"
      onSubmit={handle}
      noValidate
      aria-label="Tạo yêu cầu chỉnh sửa"
    >
      <label className="rnd-label" htmlFor={`${ids}-content`}>
        Yêu cầu chỉnh sửa mới
      </label>
      <textarea
        id={`${ids}-content`}
        className="rnd-textarea"
        rows={3}
        maxLength={MAX_TEXT}
        value={content}
        aria-invalid={!!error}
        aria-describedby={error ? `${ids}-content-error` : undefined}
        onChange={(e) => {
          setContent(e.target.value);
          setError(null);
        }}
      />
      {error && (
        <p id={`${ids}-content-error`} role="alert" className="rnd-field-err">
          {error}
        </p>
      )}
      <div className="otl-actions">
        <button type="submit" className="app-button" disabled={busy}>
          Tạo yêu cầu
        </button>
      </div>
    </form>
  );
};

const RequestItem: React.FC<{
  request: RevisionRequest;
  supervisor: boolean;
  busy: boolean;
  onResolve: (r: RevisionRequest) => void;
}> = ({ request: r, supervisor, busy, onResolve }) => {
  const open = r.status === 'open';
  return (
    <li className="otl-item">
      <div className="otl-item-head">
        <span
          className={`app-chip ${open ? 'app-chip-pending' : 'app-chip-active'}`}
        >
          {open ? 'Đang mở' : 'Đã hoàn tất'}
        </span>
        <span className="otl-meta">
          {`${r.createdBy} · ${formatDateTime(r.createdAt)} · trên Lần ${r.raisedOnVersionNo}`}
        </span>
      </div>
      <p className="otl-text">{r.content}</p>
      <p className="otl-meta">
        {r.addressedInVersions.length > 0
          ? `Nhóm đã nộp lại: Lần ${r.addressedInVersions.join(', Lần ')}`
          : 'Nhóm chưa nộp lại phiên bản xử lý yêu cầu này.'}
        {!open &&
          r.resolvedAt &&
          ` · Đóng bởi ${r.resolvedBy ?? 'GVHD'} lúc ${formatDateTime(r.resolvedAt)}`}
      </p>
      {supervisor && open && (
        <div className="otl-actions">
          <button
            type="button"
            className="app-button app-button-small"
            disabled={busy || !r.canResolve}
            aria-describedby={r.canResolve ? undefined : `otl-req-${r.id}-why`}
            onClick={() => onResolve(r)}
          >
            Xác nhận hoàn tất
          </button>
          {!r.canResolve && (
            <span id={`otl-req-${r.id}-why`} className="otl-meta">
              Chờ nhóm nộp lại phiên bản mới.
            </span>
          )}
        </div>
      )}
    </li>
  );
};

// ---------- Phiên bản ----------

const CommentEditor: React.FC<{
  submission: OutlineSubmission;
  busy: boolean;
  onSave: (comment: string) => Promise<boolean>;
}> = ({ submission, busy, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(submission.reviewComment ?? '');
  const ids = useId();
  if (!editing)
    return (
      <button
        type="button"
        className="app-button app-button-small"
        onClick={() => {
          setText(submission.reviewComment ?? '');
          setEditing(true);
        }}
      >
        {submission.reviewComment ? 'Sửa nhận xét' : 'Nhận xét'}
      </button>
    );
  return (
    <form
      className="otl-form otl-comment-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(text)) setEditing(false);
      }}
    >
      <label className="rnd-label" htmlFor={`${ids}-comment`}>
        {`Nhận xét Lần ${submission.versionNo}`}
      </label>
      <textarea
        id={`${ids}-comment`}
        className="rnd-textarea"
        rows={3}
        maxLength={MAX_TEXT}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="otl-actions">
        <button
          type="button"
          className="app-button app-button-small"
          onClick={() => setEditing(false)}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="app-button app-button-primary app-button-small"
          disabled={busy}
        >
          Lưu nhận xét
        </button>
      </div>
    </form>
  );
};

const VersionItem: React.FC<{
  topicId: string;
  outline: Outline;
  submission: OutlineSubmission;
  supervisor: boolean;
  busy: boolean;
  onComment: (s: OutlineSubmission, comment: string) => Promise<boolean>;
}> = ({ topicId, outline, submission: s, supervisor, busy, onComment }) => {
  const latest = outline.currentSubmissionId === s.id;
  const approved =
    outline.approvedVersionNo === s.versionNo && !!outline.approvedAt;
  return (
    <li className="otl-item">
      <div className="otl-item-head">
        <strong className="otl-version">{`Lần ${s.versionNo}`}</strong>
        {approved && <span className="app-chip app-chip-active">Đã duyệt</span>}
        {!approved && latest && (
          <span className="app-chip app-chip-info">Mới nhất</span>
        )}
        {s.late && <span className="app-chip app-chip-pending">Nộp trễ</span>}
        <span className="otl-meta">{`${s.submittedBy} · ${formatDateTime(s.submittedAt)}`}</span>
      </div>
      {s.note && <p className="otl-text">{s.note}</p>}
      <p className="otl-file-line">
        <FileText size={16} aria-hidden="true" />
        <span className="otl-file-name">{s.fileName}</span>
        <span className="otl-meta">{sizeText(s.sizeBytes)}</span>
      </p>
      {s.addressedRequestIds.length > 0 && (
        <p className="otl-meta">{`Xử lý ${s.addressedRequestIds.length} yêu cầu chỉnh sửa đang mở lúc nộp.`}</p>
      )}
      {s.reviewComment && (
        <blockquote className="otl-review">
          <p className="otl-meta">
            {`Nhận xét của ${s.reviewedBy ?? 'GVHD'}${s.reviewedAt ? ` · ${formatDateTime(s.reviewedAt)}` : ''}`}
          </p>
          <p className="otl-text">{s.reviewComment}</p>
        </blockquote>
      )}
      <div className="otl-actions">
        <a
          className="app-button app-button-small"
          href={outlineFileUrl(topicId, s.id)}
          download={s.fileName}
          aria-label={`Tải ${s.fileName} (Lần ${s.versionNo})`}
        >
          <Download size={16} aria-hidden="true" />
          Tải
        </a>
        {supervisor && (
          <CommentEditor
            submission={s}
            busy={busy}
            onSave={(c) => onComment(s, c)}
          />
        )}
      </div>
    </li>
  );
};

// ---------- Duyệt ----------

const ApproveDialog: React.FC<{
  version: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ version, busy, onCancel, onConfirm }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otl-approve-title"
        aria-describedby="otl-approve-text"
        className="dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h2 id="otl-approve-title" className="otl-dialog-title">
          {`Duyệt đề cương Lần ${version}?`}
        </h2>
        <p id="otl-approve-text" className="otl-text">
          Sau khi duyệt, nhóm không nộp thêm phiên bản đề cương và không tạo
          thêm yêu cầu chỉnh sửa. Trạng thái đề tài không đổi.
        </p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="app-button"
            onClick={onCancel}
            disabled={busy}
          >
            Chưa duyệt
          </button>
          <button
            type="button"
            className="app-button app-button-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {`Duyệt Lần ${version}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Khối chính ----------

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; outline: Outline };

export const OutlineSection: React.FC<OutlineSectionProps> = ({
  topicId,
  service = defaultService,
  onReady,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Giữ callback mới nhất mà không làm effect tải lại.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    service
      .get(topicId)
      .then((outline) => {
        if (cancelled) return;
        setState({ kind: 'ready', outline });
        onReadyRef.current?.(outline);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof OutlineNotFoundError
            ? { kind: 'not-found' }
            : {
                kind: 'error',
                message: errorText(err, 'Không tải được đề cương.'),
              },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [service, topicId]);

  // Mỗi thao tác trả về OutlineDto mới; lỗi hiện bằng toast (PDR-056).
  const run = useCallback(
    async (action: () => Promise<Outline>, success: string) => {
      setBusy(true);
      try {
        const outline = await action();
        setState({ kind: 'ready', outline });
        onReadyRef.current?.(outline);
        toast.success(success);
        return true;
      } catch (err: unknown) {
        toast.error(errorText(err, 'Thao tác không thành công.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (state.kind === 'loading')
    return (
      <p role="status" className="app-muted">
        Đang tải đề cương…
      </p>
    );
  if (state.kind === 'not-found')
    return (
      <section className="status-state app-empty">
        <h2>Không xem được đề cương</h2>
        <p>
          Chỉ thành viên nhóm, GV hướng dẫn và Giáo vụ xem được đề cương của đề
          tài.
        </p>
      </section>
    );
  if (state.kind === 'error')
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề cương</h2>
        <p>{state.message}</p>
      </section>
    );

  const { outline } = state;
  const supervisor = outline.viewerRole === 'supervisor';
  const member = outline.viewerRole === 'member';
  const stage = outlineStage(outline);
  const openRequests = outline.requests.filter((r) => r.status === 'open');
  const latest = outline.submissions[0];

  return (
    <section className="app-card otl-section" aria-labelledby="otl-title">
      <div className="app-card-header">
        <h2 id="otl-title">Đề cương</h2>
        <span className={`app-chip ${stage.chip}`}>{stage.text}</span>
      </div>
      <p className="otl-meta">
        {outline.deadline
          ? `Hạn nộp theo mốc Đề cương: ${formatDate(outline.deadline)}`
          : 'Đợt chưa đặt hạn mốc Đề cương.'}
        {outline.lateDeadline &&
          ` · Hạn trễ: ${formatDate(outline.lateDeadline)}`}
      </p>

      {outline.approvedAt && (
        <p className="rnd-note rnd-note-ok" role="note">
          {`${outline.approvedBy ?? 'GVHD'} đã duyệt đề cương Lần ${outline.approvedVersionNo ?? ''} lúc ${formatDateTime(outline.approvedAt)}.`}
        </p>
      )}

      {member &&
        (outline.canSubmit ? (
          <SubmitForm
            outline={outline}
            busy={busy}
            onSubmit={(file, note) =>
              run(() => service.submit(topicId, file, note), 'Đã nộp đề cương.')
            }
          />
        ) : (
          !outline.approvedAt &&
          outline.submitBlockedReason && (
            <p className="rnd-note rnd-note-grey" role="note">
              {outline.submitBlockedReason}
            </p>
          )
        ))}

      {supervisor && !outline.approvedAt && latest && (
        <div className="otl-approve">
          <button
            type="button"
            className="app-button app-button-primary"
            disabled={busy || !outline.canApprove}
            aria-describedby={
              outline.canApprove ? undefined : 'otl-approve-why'
            }
            onClick={() => setConfirming(true)}
          >
            {`Duyệt đề cương Lần ${latest.versionNo}`}
          </button>
          {!outline.canApprove && outline.approveBlockedReason && (
            <p
              id="otl-approve-why"
              className="rnd-note rnd-note-warn"
              role="note"
            >
              {outline.approveBlockedReason}
            </p>
          )}
        </div>
      )}

      <section className="otl-block" aria-labelledby="otl-req-title">
        <h3 id="otl-req-title" className="otl-subtitle">
          {`Yêu cầu chỉnh sửa (${openRequests.length} đang mở)`}
        </h3>
        {supervisor && outline.canReview && !outline.approvedAt && latest && (
          <RequestForm
            busy={busy}
            onCreate={(content) =>
              run(
                () => service.createRequest(topicId, content),
                'Đã tạo yêu cầu chỉnh sửa.',
              )
            }
          />
        )}
        {outline.requests.length === 0 ? (
          <p className="app-muted">Chưa có yêu cầu chỉnh sửa.</p>
        ) : (
          <ul className="otl-list" aria-label="Danh sách yêu cầu chỉnh sửa">
            {outline.requests.map((r) => (
              <RequestItem
                key={r.id}
                request={r}
                supervisor={supervisor}
                busy={busy}
                onResolve={(req) =>
                  void run(
                    () => service.resolveRequest(topicId, req.id),
                    'Đã xác nhận hoàn tất yêu cầu.',
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="otl-block" aria-labelledby="otl-ver-title">
        <h3 id="otl-ver-title" className="otl-subtitle">
          {`Các phiên bản (${outline.submissions.length})`}
        </h3>
        {outline.submissions.length === 0 ? (
          <p className="app-muted">Nhóm chưa nộp phiên bản đề cương nào.</p>
        ) : (
          <ol className="otl-list" aria-label="Các phiên bản đề cương">
            {outline.submissions.map((s) => (
              <VersionItem
                key={s.id}
                topicId={topicId}
                outline={outline}
                submission={s}
                supervisor={supervisor && outline.canReview}
                busy={busy}
                onComment={(sub, comment) =>
                  run(
                    () => service.comment(topicId, sub.id, comment),
                    `Đã lưu nhận xét Lần ${sub.versionNo}.`,
                  )
                }
              />
            ))}
          </ol>
        )}
      </section>

      {confirming && latest && (
        <ApproveDialog
          version={latest.versionNo}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await run(
              () => service.approve(topicId, latest.id),
              `Đã duyệt đề cương Lần ${latest.versionNo}.`,
            );
            setConfirming(false);
          }}
        />
      )}
    </section>
  );
};
