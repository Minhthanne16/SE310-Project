'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type {
  ResultOutcome,
  TopicService,
} from '@/features/topics/services/topicService';
import {
  confirmResultBlocker,
  deviationRecipients,
  formatComponentScore,
  formatScore,
  groupScoreRows,
  publishResultBlocker,
  remindDeviationBlocker,
  scoreDeviations,
  thesisCell,
  totalScore,
} from '@/features/topics/topicUtils';
import type { ScoreRole, Topic } from '@/types/topic';

interface TopicResultPanelProps {
  topic: Topic;
  topicService: TopicService;
  // Đã hết hạn chốt bản cuối (công bố không cần nhóm chốt).
  finalLockClosed: boolean;
  // Đợt đã kết thúc: chỉ xem.
  readOnly?: boolean;
  // Gọi sau khi một thao tác đổi dữ liệu để tab tải lại danh sách.
  onChanged: () => void | Promise<void>;
}

const COLUMNS: { role: ScoreRole; label: string; hint: string }[] = [
  { role: 'CBHD', label: 'HD', hint: 'Hướng dẫn · hệ số 2' },
  { role: 'CBPB', label: 'PB', hint: 'Phản biện · hệ số 2' },
  { role: 'CTHĐ', label: 'CT', hint: 'Chủ tịch HĐ · hệ số 1' },
  { role: 'TKHĐ', label: 'TK', hint: 'Thư ký HĐ · hệ số 1' },
];

const defaultMessage = (t: Topic) =>
  `Kính gửi thầy/cô,\nĐề tài ${t.code} “${t.title}” có điểm lệch từ 2 điểm trở lên giữa hội đồng và giảng viên hướng dẫn/phản biện. Nhờ thầy/cô xem lại phiếu và trao đổi với nhau, chỉnh phiếu nếu cần trước khi giáo vụ xác nhận kết quả.\nTrân trọng,\nGiáo vụ khoa`;

const errorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'Không thực hiện được.';

// Phần mở rộng ngay dưới dòng đề tài (artboard GiaoVu-DotKhoaLuan): lưới điểm
// từng sinh viên, người chấm, cờ lệch điểm và thao tác xác nhận/công bố theo
// cả nhóm đề tài (PDR-049).
export const TopicResultPanel: React.FC<TopicResultPanelProps> = ({
  topic,
  topicService,
  finalLockClosed,
  readOnly = false,
  onChanged,
}) => {
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState(() => defaultMessage(topic));
  const [unconfirming, setUnconfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [publishing, setPublishing] = useState(false);

  const rows = groupScoreRows(topic);
  const recipients = deviationRecipients(topic);
  const thesis = thesisCell(topic);
  const confirmWhy = confirmResultBlocker(topic);
  const publishWhy = publishResultBlocker(topic, finalLockClosed);
  const canRemind = remindDeviationBlocker(topic) === null;
  const students = topic.group.length || rows.length;

  const pairs = rows.flatMap((s) =>
    scoreDeviations(s.scores).pairs.map((p) => ({
      key: `${s.studentId}-${p.council}-${p.lecturer}`,
      text: `${s.name}: ${p.council} ${formatComponentScore(
        s.scores[p.council],
      )} – ${p.lecturer} ${formatComponentScore(s.scores[p.lecturer])} (lệch ${formatScore(p.diff)})`,
    })),
  );

  const graders: { role: string; name: string | null }[] = [
    { role: 'CBHD', name: topic.supervisor.name },
    { role: 'CBPB', name: topic.reviewer?.name ?? null },
    { role: 'CTHĐ', name: topic.defense?.chair ?? null },
    { role: 'TKHĐ', name: topic.defense?.secretary ?? null },
  ];

  const run = async (
    action: () => Promise<ResultOutcome>,
    after?: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await action();
      setFlash({ ok: out.ok, text: out.message });
      if (out.ok) after?.();
      await onChanged();
    } catch (err: unknown) {
      setFlash({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    run(async () => (await topicService.confirmResults([topic.id]))[0]);
  const publish = () =>
    run(
      async () => (await topicService.publishResults([topic.id]))[0],
      () => setPublishing(false),
    );
  const unconfirm = () =>
    run(
      () => topicService.unconfirmResult(topic.id, reason),
      () => {
        setUnconfirming(false);
        setReason('');
      },
    );
  const send = () =>
    run(
      async () => {
        const out = (
          await topicService.remindDeviations([topic.id], message)
        )[0];
        return out.ok
          ? {
              ...out,
              message: `Đã gửi nhắc cho ${recipients.length} giảng viên trong cặp lệch.`,
            }
          : out;
      },
      () => setComposing(false),
    );

  return (
    <div className="rnd-result" aria-label={`Chi tiết kết quả ${topic.code}`}>
      <div className="rnd-result-main">
        <table className="rnd-score-grid">
          <caption className="app-visually-hidden">
            Điểm từng sinh viên của {topic.code}
          </caption>
          <thead>
            <tr>
              <th scope="col">Sinh viên</th>
              {COLUMNS.map((c) => (
                <th key={c.role} scope="col" title={c.hint}>
                  {c.label}
                </th>
              ))}
              <th scope="col">Điểm KL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const dev = scoreDeviations(s.scores).roles;
              const total = totalScore(s.scores);
              return (
                <tr key={s.studentId}>
                  <th scope="row">
                    {s.name}
                    <span className="rnd-meta">{s.code}</span>
                  </th>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.role}
                      className={
                        dev.has(c.role)
                          ? 'rnd-score-dev'
                          : s.scores[c.role] === null
                            ? 'rnd-score-miss'
                            : ''
                      }
                    >
                      {formatComponentScore(s.scores[c.role])}
                      {dev.has(c.role) && (
                        <span className="app-visually-hidden"> (lệch)</span>
                      )}
                    </td>
                  ))}
                  <td>
                    <b>{formatScore(total)}</b>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="rnd-meta">
                  Chưa có sinh viên trong nhóm.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <dl className="rnd-graders" aria-label="Người chấm">
          {graders.map((g) => (
            <div key={g.role}>
              <dt>{g.role}</dt>
              <dd className={g.name ? '' : 'rnd-cell-warn'}>
                {g.name ?? 'Chưa phân công'}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className="rnd-dev-box"
        role="group"
        aria-label="Cờ lệch điểm hội đồng"
      >
        <b>Cờ lệch điểm hội đồng (≥ 2 điểm)</b>
        {pairs.length === 0 ? (
          <p>Không có cặp điểm lệch.</p>
        ) : (
          <ul>
            {pairs.map((p) => (
              <li key={p.key}>{p.text}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="rnd-result-thesis">
        Khóa luận: <b>{thesis.label}</b> · {thesis.sub}.{' '}
        <Link
          className="rnd-row-link"
          href={`/giao-vu/de-tai/${encodeURIComponent(topic.id)}`}
        >
          Mở chi tiết đề tài
        </Link>
      </p>

      {flash && (
        <div
          role="status"
          className={`rnd-banner ${flash.ok ? 'rnd-banner-ok' : 'rnd-banner-warn'}`}
        >
          {flash.text}
        </div>
      )}

      {readOnly ? (
        <p className="rnd-meta">Đợt đã kết thúc nên kết quả chỉ để xem.</p>
      ) : topic.status === 'Đã hoàn tất' ? (
        <p className="rnd-meta">
          Kết quả đã công bố cho cả nhóm, chỉ để xem. Không có thao tác mở lại
          thông thường.
        </p>
      ) : topic.status === 'Đã xác nhận' ? (
        <div className="rnd-result-actions">
          {!unconfirming && !publishing && (
            <div className="rnd-result-buttons">
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-danger-outline"
                disabled={busy}
                onClick={() => {
                  setUnconfirming(true);
                  setFlash(null);
                }}
              >
                Hủy xác nhận
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-primary"
                disabled={busy || publishWhy !== null}
                aria-describedby={
                  publishWhy ? `why-pub-${topic.id}` : undefined
                }
                onClick={() => {
                  setPublishing(true);
                  setFlash(null);
                }}
              >
                Công bố kết quả
              </button>
            </div>
          )}
          {publishWhy && !unconfirming && (
            <p id={`why-pub-${topic.id}`} className="rnd-why">
              {publishWhy}
            </p>
          )}
          {publishing && (
            <div
              className="rnd-inline-confirm"
              role="group"
              aria-label="Xác nhận công bố"
            >
              <p>Công bố kết quả cho {students} sinh viên của nhóm?</p>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-primary"
                disabled={busy}
                onClick={() => void publish()}
              >
                Công bố
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm"
                onClick={() => setPublishing(false)}
              >
                Để sau
              </button>
            </div>
          )}
          {unconfirming && (
            <div
              className="rnd-inline-confirm"
              role="group"
              aria-label="Hủy xác nhận"
            >
              <label htmlFor={`un-${topic.id}`}>
                Lý do hủy xác nhận (bắt buộc, ghi vào lịch sử)
              </label>
              <textarea
                id={`un-${topic.id}`}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="rnd-meta">
                Cả nhóm về Đã cho điểm để giảng viên sửa phiếu rồi xác nhận lại.
              </p>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-danger"
                disabled={busy || reason.trim() === ''}
                onClick={() => void unconfirm()}
              >
                Hủy xác nhận kết quả
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm"
                onClick={() => {
                  setUnconfirming(false);
                  setReason('');
                }}
              >
                Không hủy
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rnd-result-actions">
          <div className="rnd-result-buttons">
            <button
              type="button"
              className="rnd-btn rnd-btn-sm rnd-btn-primary"
              disabled={busy || confirmWhy !== null}
              aria-describedby={confirmWhy ? `why-conf-${topic.id}` : undefined}
              onClick={() => void confirm()}
            >
              Xác nhận kết quả
            </button>
            {canRemind && !composing && (
              <button
                type="button"
                className="rnd-btn rnd-btn-sm"
                onClick={() => {
                  setMessage(defaultMessage(topic));
                  setComposing(true);
                  setFlash(null);
                }}
              >
                Gửi thông báo
              </button>
            )}
          </div>
          {confirmWhy && (
            <p id={`why-conf-${topic.id}`} className="rnd-why">
              {confirmWhy}
            </p>
          )}
          {composing && (
            <div
              className="rnd-inline-confirm"
              role="group"
              aria-label="Soạn thông báo lệch điểm"
            >
              <p>
                <b>Tiêu đề:</b> [Lệch điểm] {topic.code} · đề nghị xem lại phiếu
              </p>
              <p>
                <b>Gửi đến {recipients.length} giảng viên trong cặp lệch:</b>{' '}
                {recipients.join(', ')}. Không gửi cho sinh viên.
              </p>
              <label htmlFor={`msg-${topic.id}`}>Nội dung</label>
              <textarea
                id={`msg-${topic.id}`}
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                type="button"
                className="rnd-btn rnd-btn-sm rnd-btn-primary"
                disabled={busy || message.trim() === ''}
                onClick={() => void send()}
              >
                Gửi
              </button>
              <button
                type="button"
                className="rnd-btn rnd-btn-sm"
                onClick={() => setComposing(false)}
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
