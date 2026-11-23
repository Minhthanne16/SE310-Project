'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateInput } from '@/components/ui/DateInput';
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
import { formatDateTime } from '@/features/rounds/roundUtils';
import type { RevisionRequest } from '@/types/outline';
import type {
  SubmissionKind,
  SubmissionKindState,
  SubmissionVersion,
  TopicSubmissions,
} from '@/types/submission';
import '@/features/submissions/submissions.css';

export interface SubmissionPanelProps {
  topicId: string;
  service?: SubmissionService;
  kind?: SubmissionKind;
  data?: TopicSubmissions;
  onSubmitted?: (data: TopicSubmissions) => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: TopicSubmissions };

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

// Báo cáo giữa kỳ/cuối kỳ của một đề tài (P04-S02, PDR-060): thành viên nhóm nộp PDF,
// GVHD nhận xét cho từng bản nộp, tạo/đóng checklist yêu cầu chỉnh sửa.
export const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  topicId,
  service = defaultService,
  kind,
  data,
  onSubmitted,
}) => {
  const [state, setState] = useState<State>(
    data ? { kind: 'ready', data } : { kind: 'loading' },
  );

  useEffect(() => {
    if (data) {
      setState({ kind: 'ready', data });
    }
  }, [data]);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const result = await service.list(topicId);
      setState({ kind: 'ready', data: result });
      onSubmitted?.(result);
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: errorText(err, 'Không tải được danh sách bài nộp.'),
      });
    }
  }, [service, topicId, onSubmitted]);

  useEffect(() => {
    if (!data) {
      void load();
    }
  }, [data, load]);

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

  const kindsToRender = kind
    ? state.data.kinds.filter((k) => k.kind === kind)
    : state.data.kinds;

  return (
    <div className="sub-panel">
      {kindsToRender.map((k) => (
        <KindSection
          key={k.kind}
          topicId={topicId}
          kind={k}
          maxBytes={state.data.maxBytes}
          service={service}
          onSubmitted={(nextData) => {
            setState({ kind: 'ready', data: nextData });
            onSubmitted?.(nextData);
          }}
          onLock={(id) => service.lock(topicId, id)}
          onGrant={(end, reason) =>
            service.grantExtension(topicId, end, reason)
          }
          onIneligible={(reason) => service.markIneligible(topicId, reason)}
        />
      ))}
    </div>
  );
};

interface KindSectionProps {
  topicId: string;
  kind: SubmissionKindState;
  maxBytes: number;
  service: SubmissionService;
  onSubmitted: (data: TopicSubmissions) => void;
  onLock: (id: string) => Promise<TopicSubmissions>;
  onGrant: (end: string, reason: string) => Promise<TopicSubmissions>;
  onIneligible: (reason: string) => Promise<TopicSubmissions>;
}

const KindSection: React.FC<KindSectionProps> = ({
  topicId,
  kind,
  maxBytes,
  service,
  onSubmitted,
  onLock,
  onGrant,
  onIneligible,
}) => {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [noteProblem, setNoteProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [locking, setLocking] = useState<string | null>(null);
  const [extensionEnd, setExtensionEnd] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  // Thêm yêu cầu chỉnh sửa
  const [requestText, setRequestText] = useState('');
  const [requestSending, setRequestSending] = useState(false);

  const pick = (next: File | null) => {
    setFile(next);
    setFileProblem(next ? fileError(next, maxBytes) : null);
    setFailure(null);
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
    try {
      const data = await service.submit(topicId, kind.kind, file, note);
      const latest = data.kinds.find((k) => k.kind === kind.kind)?.versions[0];
      setFile(null);
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
      onSubmitted(data);
      toast.success(
        latest
          ? `Đã nộp bản ${latest.version}${latest.isLate ? ' (nộp trễ)' : ''}.`
          : 'Đã nộp.',
      );
    } catch (err: unknown) {
      setFailure(errorText(err, 'Chưa nộp được. Thử lại sau.'));
      toast.error(errorText(err, 'Chưa nộp được. Thử lại sau.'));
    } finally {
      setSending(false);
    }
  };

  const decide = async (action: 'grant' | 'ineligible') => {
    if (!decisionReason.trim() || (action === 'grant' && !extensionEnd)) {
      setFailure(
        action === 'grant'
          ? 'Nhập hạn bổ sung và lý do quyết định.'
          : 'Nhập lý do quyết định.',
      );
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const data =
        action === 'grant'
          ? await onGrant(extensionEnd, decisionReason.trim())
          : await onIneligible(decisionReason.trim());
      onSubmitted(data);
      setDecisionReason('');
      toast.success(
        action === 'grant' ? 'Đã cấp hạn bổ sung.' : 'Đã kết thúc đề tài.',
      );
    } catch (error) {
      setFailure(errorText(error, 'Không lưu được quyết định.'));
      toast.error(errorText(error, 'Không lưu được quyết định.'));
    } finally {
      setSending(false);
    }
  };

  const lock = async () => {
    if (!locking) return;
    setSending(true);
    setFailure(null);
    try {
      onSubmitted(await onLock(locking));
      setLocking(null);
      toast.success('Đã chốt bản khóa luận cuối.');
    } catch (error) {
      setFailure(errorText(error, 'Không chốt được bản cuối.'));
      toast.error(errorText(error, 'Không chốt được bản cuối.'));
    } finally {
      setSending(false);
    }
  };

  const handleComment = async (submissionId: string, comment: string) => {
    try {
      const nextData = await service.comment(topicId, submissionId, comment);
      toast.success('Đã lưu nhận xét.');
      onSubmitted(nextData);
      return true;
    } catch (err: unknown) {
      toast.error(errorText(err, 'Không lưu được nhận xét.'));
      return false;
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestText.trim() || requestSending) return;
    setRequestSending(true);
    try {
      const nextData = await service.createRequest(
        topicId,
        kind.kind,
        requestText.trim(),
      );
      toast.success('Đã gửi yêu cầu chỉnh sửa cho nhóm.');
      setRequestText('');
      onSubmitted(nextData);
    } catch (err: unknown) {
      toast.error(errorText(err, 'Không gửi được yêu cầu chỉnh sửa.'));
    } finally {
      setRequestSending(false);
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    try {
      const nextData = await service.resolveRequest(topicId, requestId);
      toast.success('Đã xác nhận hoàn tất yêu cầu.');
      onSubmitted(nextData);
    } catch (err: unknown) {
      toast.error(errorText(err, 'Không thể xác nhận hoàn tất yêu cầu.'));
    }
  };

  const openRequestsCount = (kind.requests ?? []).filter(
    (r) => r.status === 'open',
  ).length;

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
        {openRequestsCount > 0 ? (
          <span className="app-chip app-chip-pending">
            {`${openRequestsCount} yêu cầu cần sửa`}
          </span>
        ) : null}
      </header>
      <p className="sub-muted">{deadlineText(kind)}</p>
      {kind.kind === 'thesis' && kind.extensionDeadline ? (
        <p className="sub-banner sub-banner-warn" role="note">
          Hạn bổ sung riêng: hết ngày{' '}
          {kind.extensionDeadline.split('-').reverse().join('/')} · Lý do:{' '}
          {kind.extensionReason}
        </p>
      ) : null}
      {kind.waitingException ? (
        <p className="sub-banner sub-banner-warn" role="note">
          Chưa có bản khóa luận; chờ Giáo vụ xử lý ngoại lệ.
        </p>
      ) : null}
      {kind.ineligibleReason ? (
        <p className="sub-banner sub-banner-bad" role="note">
          Không đủ điều kiện công bố · Lý do: {kind.ineligibleReason}
        </p>
      ) : null}
      {kind.kind === 'thesis' && kind.versions.some((v) => v.isFinal) ? (
        <span className="sub-chip sub-chip-ok">Đã chốt bản cuối</span>
      ) : null}
      {kind.canGrantExtension || kind.canMarkIneligible ? (
        <div className="sub-form">
          {kind.canGrantExtension ? (
            <div className="sub-field">
              <label htmlFor={`${id}-end`}>Hạn bổ sung</label>
              <DateInput
                id={`${id}-end`}
                value={extensionEnd}
                aria-invalid={
                  failure?.startsWith('Nhập hạn bổ sung') && !extensionEnd
                    ? true
                    : undefined
                }
                aria-describedby={
                  failure?.startsWith('Nhập hạn bổ sung') && !extensionEnd
                    ? `${id}-decision-error`
                    : undefined
                }
                onChange={setExtensionEnd}
              />
            </div>
          ) : null}
          <div className="sub-field">
            <label htmlFor={`${id}-reason`}>Lý do quyết định</label>
            <textarea
              id={`${id}-reason`}
              maxLength={800}
              value={decisionReason}
              aria-invalid={
                failure?.startsWith('Nhập ') && !decisionReason.trim()
                  ? true
                  : undefined
              }
              aria-describedby={
                failure?.startsWith('Nhập ') && !decisionReason.trim()
                  ? `${id}-decision-error`
                  : undefined
              }
              onChange={(e) => setDecisionReason(e.target.value)}
            />
          </div>
          <div>
            {kind.canGrantExtension ? (
              <button
                type="button"
                className="app-button"
                disabled={sending}
                onClick={() => void decide('grant')}
              >
                Cấp hạn bổ sung
              </button>
            ) : null}
            {kind.canMarkIneligible ? (
              <button
                type="button"
                className="app-button app-button-danger"
                disabled={sending}
                onClick={() => void decide('ineligible')}
              >
                Không đủ điều kiện công bố
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {failure ? (
        <p
          id={`${id}-decision-error`}
          className="sub-banner sub-banner-bad"
          role="alert"
        >
          {failure}
        </p>
      ) : null}

      {kind.canSubmit ? (
        <form className="sub-form" onSubmit={submit} noValidate>
          {kind.window === 'late' ? (
            <p className="sub-banner sub-banner-warn">
              Đã qua hạn thường. Bài nộp bây giờ sẽ được gắn nhãn “Nộp trễ”.
            </p>
          ) : null}
          {openRequestsCount > 0 ? (
            <p className="sub-banner sub-banner-warn" role="note">
              {`Phiên bản nộp mới sẽ liên kết và xử lý cho cả ${openRequestsCount} yêu cầu chỉnh sửa đang mở.`}
            </p>
          ) : null}
          <div className="sub-field">
            <label htmlFor={`${id}-file`}>
              Tệp báo cáo (PDF, tối đa 20 MB)
            </label>
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

      {kind.lockBlockedReason ? (
        <p className="sub-banner sub-banner-warn" role="note">
          {kind.lockBlockedReason}
        </p>
      ) : null}

      {kind.versions.length === 0 ? (
        <p className="sub-empty">Chưa có bản nào được nộp.</p>
      ) : (
        <ul className="sub-versions" aria-label={`Các phiên bản ${kind.name}`}>
          {kind.versions.map((v) => (
            <VersionItem
              key={v.id}
              version={v}
              kindName={kind.name}
              canReview={kind.canReview}
              onComment={(comment) => handleComment(v.id, comment)}
              canLock={kind.canLock}
              sending={sending}
              onLockClick={() => setLocking(v.id)}
            />
          ))}
        </ul>
      )}

      {/* Checklist yêu cầu chỉnh sửa */}
      <RevisionRequestsSection
        kind={kind}
        canReview={kind.canReview}
        requestText={requestText}
        requestSending={requestSending}
        onRequestTextChange={setRequestText}
        onCreateRequest={handleCreateRequest}
        onResolveRequest={handleResolveRequest}
      />
      {locking ? (
        <ConfirmDialog
          title="Chốt bản khóa luận cuối"
          description="Sau khi chốt, nhóm không thể nộp thêm hoặc chọn lại bản khác."
          cancelLabel="Giữ chưa chốt"
          confirmLabel="Chốt bản cuối"
          busy={sending}
          onCancel={() => setLocking(null)}
          onConfirm={() => void lock()}
        />
      ) : null}
    </section>
  );
};

interface VersionItemProps {
  version: SubmissionVersion;
  kindName: string;
  canReview: boolean;
  onComment: (comment: string) => Promise<boolean>;
  canLock: boolean;
  sending: boolean;
  onLockClick: () => void;
}

const VersionItem: React.FC<VersionItemProps> = ({
  version: v,
  kindName,
  canReview,
  onComment,
  canLock,
  sending,
  onLockClick,
}) => {
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(v.reviewComment ?? '');
  const [savingComment, setSavingComment] = useState(false);

  const saveComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingComment(true);
    const ok = await onComment(commentDraft.trim());
    setSavingComment(false);
    if (ok) setEditingComment(false);
  };

  return (
    <li className="sub-version">
      <div className="sub-version-main">
        <strong>Bản {v.version}</strong>
        {v.isLatest ? (
          <span className="sub-chip sub-chip-info">Mới nhất</span>
        ) : null}
        {v.isFinal ? (
          <span className="sub-chip sub-chip-ok">Bản cuối</span>
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

      {v.addressedRequestIds?.length > 0 ? (
        <div className="sub-muted">
          {`Xử lý ${v.addressedRequestIds.length} yêu cầu chỉnh sửa đang mở lúc nộp.`}
        </div>
      ) : null}

      {v.reviewComment ? (
        <blockquote className="sub-review">
          <div className="sub-review-head">
            <span>
              {`Nhận xét của ${v.reviewedBy ?? 'GVHD'}${v.reviewedAt ? ` · ${formatDateTime(v.reviewedAt)}` : ''}`}
            </span>
          </div>
          <p className="sub-review-text">{v.reviewComment}</p>
        </blockquote>
      ) : null}

      {canReview && !editingComment ? (
        <div>
          <button
            type="button"
            className="app-button app-button-small"
            onClick={() => {
              setCommentDraft(v.reviewComment ?? '');
              setEditingComment(true);
            }}
          >
            {v.reviewComment ? 'Sửa nhận xét' : 'Nhận xét'}
          </button>
        </div>
      ) : null}

      {canReview && editingComment ? (
        <form className="sub-comment-editor" onSubmit={saveComment}>
          <label htmlFor={`comment-${v.id}`} className="sub-muted">
            {`Nhận xét Bản ${v.version} (tối đa 2000 ký tự)`}
          </label>
          <textarea
            id={`comment-${v.id}`}
            rows={3}
            maxLength={2000}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
          />
          <div className="sub-comment-actions">
            <button
              type="submit"
              className="app-button app-button-primary app-button-small"
              disabled={savingComment}
            >
              {savingComment ? 'Đang lưu…' : 'Lưu nhận xét'}
            </button>
            <button
              type="button"
              className="app-button app-button-small"
              onClick={() => setEditingComment(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      <a
        className="sub-btn"
        href={v.downloadUrl}
        download={v.fileName}
        aria-label={`Tải bản ${v.version} ${kindName}`}
      >
        Tải
      </a>
      {canLock ? (
        <button
          type="button"
          className="app-button"
          disabled={sending}
          onClick={onLockClick}
        >
          {`Chốt bản ${v.version}`}
        </button>
      ) : null}
    </li>
  );
};

interface RevisionRequestsSectionProps {
  kind: SubmissionKindState;
  canReview: boolean;
  requestText: string;
  requestSending: boolean;
  onRequestTextChange: (text: string) => void;
  onCreateRequest: (e: React.FormEvent) => Promise<void>;
  onResolveRequest: (id: string) => Promise<void>;
}

const RevisionRequestsSection: React.FC<RevisionRequestsSectionProps> = ({
  kind,
  canReview,
  requestText,
  requestSending,
  onRequestTextChange,
  onCreateRequest,
  onResolveRequest,
}) => {
  const requests = kind.requests ?? [];
  const openCount = requests.filter((r) => r.status === 'open').length;

  return (
    <section
      className="sub-requests"
      aria-label={`Yêu cầu chỉnh sửa ${kind.name}`}
    >
      <h3 className="sub-requests-title">
        <span>Yêu cầu chỉnh sửa</span>
        {requests.length > 0 ? (
          <span className="sub-muted">
            {`(${openCount} đang mở / ${requests.length} tổng cộng)`}
          </span>
        ) : null}
      </h3>

      {/* Form thêm yêu cầu chỉnh sửa cho GVHD */}
      {canReview && kind.versions.length > 0 ? (
        <form className="sub-add-request-form" onSubmit={onCreateRequest}>
          <label htmlFor={`req-${kind.kind}`} className="sub-muted">
            Thêm yêu cầu chỉnh sửa cho nhóm sinh viên (tối đa 2000 ký tự)
          </label>
          <textarea
            id={`req-${kind.kind}`}
            rows={2}
            maxLength={2000}
            placeholder="Nhập nội dung cần chỉnh sửa, bổ sung…"
            value={requestText}
            disabled={requestSending}
            onChange={(e) => onRequestTextChange(e.target.value)}
          />
          <div>
            <button
              type="submit"
              className="app-button app-button-primary app-button-small"
              disabled={requestSending || !requestText.trim()}
            >
              {requestSending ? 'Đang gửi…' : 'Gửi yêu cầu chỉnh sửa'}
            </button>
          </div>
        </form>
      ) : null}

      {requests.length === 0 ? (
        <p className="sub-muted">Chưa có yêu cầu chỉnh sửa nào.</p>
      ) : (
        <ul className="sub-request-list">
          {requests.map((r) => (
            <RequestItem
              key={r.id}
              request={r}
              canReview={canReview}
              onResolve={() => onResolveRequest(r.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

interface RequestItemProps {
  request: RevisionRequest;
  canReview: boolean;
  onResolve: () => void;
}

const RequestItem: React.FC<RequestItemProps> = ({
  request: r,
  canReview,
  onResolve,
}) => {
  const open = r.status === 'open';

  return (
    <li className="sub-request-item">
      <div className="sub-request-head">
        <span
          className={`app-chip ${open ? 'app-chip-pending' : 'app-chip-active'}`}
        >
          {open ? 'Đang mở' : 'Đã hoàn tất'}
        </span>
        <span className="sub-request-meta">
          {`${r.createdBy} · ${formatDateTime(r.createdAt)} · trên Bản ${r.raisedOnVersionNo}`}
        </span>
      </div>
      <p className="sub-request-content">{r.content}</p>
      <div className="sub-request-meta">
        {r.addressedInVersions?.length > 0
          ? `Nhóm đã nộp lại: Bản ${r.addressedInVersions.join(', Bản ')}`
          : 'Nhóm chưa nộp lại phiên bản xử lý yêu cầu này.'}
        {!open && r.resolvedAt
          ? ` · Đóng bởi ${r.resolvedBy ?? 'GVHD'} lúc ${formatDateTime(r.resolvedAt)}`
          : null}
      </div>

      {canReview && open ? (
        <div className="sub-request-actions">
          <button
            type="button"
            className="app-button app-button-small"
            disabled={!r.canResolve}
            aria-describedby={r.canResolve ? undefined : `sub-req-${r.id}-why`}
            onClick={onResolve}
          >
            Xác nhận hoàn tất
          </button>
          {!r.canResolve ? (
            <span id={`sub-req-${r.id}-why`} className="sub-request-meta">
              Chờ nhóm nộp lại phiên bản mới.
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};
