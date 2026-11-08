'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import '@/features/topics/topics.css';
import { formatDate } from '@/features/rounds/roundUtils';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  lecturerTopicService as defaultService,
  type LecturerTopicService,
} from '@/features/topics/services/topicApiService';
import { useDialogFocus } from '@/lib/useDialogFocus';
import type { Round } from '@/types/round';
import type { LecturerTopicList, TopicDto, TopicInput } from '@/types/topic';

interface LecturerTopicsPageProps {
  service?: LecturerTopicService;
}

// Gợi ý cho ô Lĩnh vực (vẫn nhập tự do).
const FIELD_SUGGESTIONS = [
  'Phát triển phần mềm',
  'Trí tuệ nhân tạo',
  'Khoa học dữ liệu',
  'Hệ thống thông tin',
  'An toàn thông tin',
  'Mạng máy tính',
];

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const dateText = (iso: string) => (iso ? formatDate(iso.slice(0, 10)) : '');

const emptyInput = (): TopicInput => ({
  title: '',
  field: '',
  description: '',
  requirements: '',
});

type FormErrors = Partial<Record<keyof TopicInput, string>>;

function validate(input: TopicInput): FormErrors {
  const errors: FormErrors = {};
  if (!input.title.trim()) errors.title = 'Nhập tên đề tài.';
  if (!input.field.trim()) errors.field = 'Chọn lĩnh vực.';
  if (!input.description.trim()) errors.description = 'Nhập mô tả đề tài.';
  return errors;
}

// Lý do không thêm/sửa/xóa và mức đề tài của đợt (DESIGN · Đề tài của tôi).
function PhaseNote({ data }: { data: LecturerTopicList }) {
  const { round } = data;
  if (round.topicsPublishedAt)
    return (
      <p className="tpc-publish-line" role="status">
        Đã công bố danh sách ngày {dateText(round.topicsPublishedAt)}: không
        thêm hoặc xóa đề tài; chỉ sửa mô tả và yêu cầu của đề tài chưa có nhóm.
      </p>
    );
  return (
    <p className="tpc-publish-line" role="status">
      Đang gửi đề tài
      {round.submissionEnd ? ` (hạn ${dateText(round.submissionEnd)})` : ''}:
      thêm, sửa, xóa tự do đến khi Giáo vụ công bố danh sách.
    </p>
  );
}

function LoadNote({ data }: { data: LecturerTopicList }) {
  const { load } = data;
  if (load.level === 'over')
    return (
      <div className="tpc-banner tpc-banner-warn" role="note">
        Bạn đang có {load.count} đề tài, vượt mức tối đa {load.max} đề tài của
        đợt. Đây chỉ là cảnh báo, Giáo vụ sẽ thấy cờ “GV vượt mức”.
      </div>
    );
  if (load.level === 'below')
    return (
      <div className="tpc-banner tpc-banner-info" role="note">
        Bạn đang có {load.count} đề tài, chưa đạt mức tối thiểu {load.min} đề
        tài của đợt.
      </div>
    );
  return null;
}

interface TopicFormProps {
  topic: TopicDto | null;
  contentOnly: boolean;
  onCancel: () => void;
  onSubmit: (input: TopicInput) => Promise<void>;
}

const TopicForm: React.FC<TopicFormProps> = ({
  topic,
  contentOnly,
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = useState<TopicInput>(
    topic
      ? {
          title: topic.title,
          field: topic.field,
          description: topic.description,
          requirements: topic.requirements ?? '',
        }
      : emptyInput(),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();

  const set = (key: keyof TopicInput, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0 || saving) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err: unknown) {
      setServerError(errorText(err, 'Không lưu được đề tài.'));
      setSaving(false);
    }
  };

  const field = (
    key: keyof TopicInput,
    label: string,
    options: { required?: boolean; multiline?: boolean; locked?: boolean },
  ) => {
    const id = `topic-${key}`;
    const errorId = `${id}-error`;
    const common = {
      id,
      value: values[key],
      disabled: options.locked || saving,
      'aria-invalid': errors[key] ? true : undefined,
      'aria-describedby': errors[key] ? errorId : undefined,
    };
    return (
      <div className="tpc-form-field">
        <label htmlFor={id}>
          {label}
          {options.required && <span aria-hidden="true"> *</span>}
        </label>
        {options.multiline ? (
          <textarea
            {...common}
            rows={key === 'description' ? 5 : 3}
            onChange={(e) => set(key, e.target.value)}
          />
        ) : (
          <input
            {...common}
            list={key === 'field' ? 'topic-field-options' : undefined}
            onChange={(e) => set(key, e.target.value)}
          />
        )}
        {errors[key] && (
          <p id={errorId} className="tpc-form-error">
            {errors[key]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="tpc-backdrop">
      <div
        ref={dialogRef}
        className="tpc-dialog tpc-dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-form-title"
        onKeyDown={(e) => e.key === 'Escape' && !saving && onCancel()}
      >
        <h2 id="topic-form-title">
          {topic ? `Sửa đề tài ${topic.code}` : 'Thêm đề tài'}
        </h2>
        {contentOnly && (
          <p className="tpc-dialog-warn">
            Danh sách đã công bố nên chỉ sửa được mô tả và yêu cầu; tên đề tài
            và lĩnh vực bị khóa.
          </p>
        )}
        {serverError && (
          <p className="tpc-dialog-err" role="alert">
            {serverError}
          </p>
        )}
        <form className="tpc-form" onSubmit={submit} noValidate>
          {field('title', 'Tên đề tài', {
            required: true,
            locked: contentOnly,
          })}
          {field('field', 'Lĩnh vực', { required: true, locked: contentOnly })}
          <datalist id="topic-field-options">
            {FIELD_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {field('description', 'Mô tả', { required: true, multiline: true })}
          {field('requirements', 'Yêu cầu', { multiline: true })}
          <div className="tpc-dialog-actions">
            <button
              type="button"
              className="tpc-btn"
              onClick={onCancel}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="tpc-btn tpc-btn-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Đang lưu...' : topic ? 'Lưu thay đổi' : 'Gửi đề tài'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ConfirmDeleteProps {
  topic: TopicDto;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  topic,
  onCancel,
  onConfirm,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>();
  return (
    <div className="tpc-backdrop">
      <div
        ref={dialogRef}
        className="tpc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="topic-delete-title"
        aria-describedby="topic-delete-text"
        onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}
      >
        <h2 id="topic-delete-title">Xóa đề tài?</h2>
        <p id="topic-delete-text">
          Xóa “{topic.title}” ({topic.code}). Đề tài chưa công bố nên sinh viên
          chưa thấy; thao tác không hoàn tác được.
        </p>
        {error && (
          <p className="tpc-dialog-err" role="alert">
            {error}
          </p>
        )}
        <div className="tpc-dialog-actions">
          <button
            type="button"
            className="tpc-btn"
            onClick={onCancel}
            disabled={busy}
          >
            Giữ đề tài
          </button>
          <button
            type="button"
            className="tpc-btn tpc-btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch (err: unknown) {
                setError(errorText(err, 'Không xóa được đề tài.'));
                setBusy(false);
              }
            }}
          >
            {busy ? 'Đang xóa...' : 'Xóa đề tài'}
          </button>
        </div>
      </div>
    </div>
  );
};

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; topic: TopicDto }
  | { kind: 'delete'; topic: TopicDto }
  | null;

// GV-DeTai: gửi đề tài vào đợt, sửa, xóa (P03-S01, PDR-053).
export const LecturerTopicsPage: React.FC<LecturerTopicsPageProps> = ({
  service = defaultService,
}) => {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState('');
  const [data, setData] = useState<LecturerTopicList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    let cancelled = false;
    service
      .listRounds()
      .then((list) => {
        if (cancelled) return;
        const visible = list.filter((r) => r.status !== 'Nháp');
        setRounds(visible);
        setRoundId(
          (visible.find((r) => r.status === 'Đang diễn ra') ?? visible[0])
            ?.id ?? '',
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, 'Không tải được đợt.'));
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const load = useCallback(
    async (id: string) => {
      try {
        setError(null);
        setData(await service.listMine(id));
      } catch (err: unknown) {
        setError(errorText(err, 'Không tải được đề tài.'));
      }
    },
    [service],
  );

  useEffect(() => {
    if (roundId) void load(roundId);
  }, [roundId, load]);

  const afterChange = async (message: string) => {
    setDialog(null);
    setNotice(message);
    await load(roundId);
  };

  if (error && !data)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{error}</p>
      </section>
    );
  if (rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài...
      </p>
    );
  if (rounds.length === 0)
    return (
      <div className="tpc-page">
        <div className="tpc-head">
          <div className="tpc-head-text">
            <h1>Đề tài của tôi</h1>
          </div>
        </div>
        <section className="status-state app-empty">
          <h2>Chưa có đợt</h2>
          <p>
            Bạn chưa thuộc đợt khóa luận nào đang mở. Giáo vụ thêm giảng viên
            vào đợt trước khi gửi đề tài.
          </p>
        </section>
      </div>
    );

  const current = data && data.round.roundId === roundId ? data : null;

  return (
    <div className="tpc-page">
      <div className="tpc-round-row">
        <label htmlFor="gv-round">Đợt</label>
        <select
          id="gv-round"
          className="tpc-select"
          value={roundId}
          onChange={(e) => {
            // Không xóa data: chỉ dữ liệu khớp đợt đang chọn mới hiện (current),
            // chọn lại đúng đợt cũ thì effect không chạy lại.
            setNotice(null);
            setRoundId(e.target.value);
          }}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tpc-head">
        <div className="tpc-head-text">
          <h1>Đề tài của tôi</h1>
          <p>
            Gửi đề tài vào đợt để Giáo vụ công bố cho sinh viên đăng ký. Số đề
            tài của bạn gồm đề tài bạn gửi và đề xuất của sinh viên bạn đã chấp
            nhận.
          </p>
        </div>
        <div className="tpc-actions">
          <button
            type="button"
            className="tpc-btn tpc-btn-primary"
            disabled={!current?.round.canSubmit}
            aria-describedby={
              current && !current.round.canSubmit
                ? 'gv-submit-blocked'
                : undefined
            }
            onClick={() => {
              setNotice(null);
              setDialog({ kind: 'create' });
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Thêm đề tài
          </button>
        </div>
      </div>

      {current && <PhaseNote data={current} />}
      {current &&
        !current.round.canSubmit &&
        current.round.submitBlockedReason && (
          <p id="gv-submit-blocked" className="tpc-hint">
            {current.round.submitBlockedReason}
          </p>
        )}
      {current && <LoadNote data={current} />}
      {notice && (
        <div className="tpc-banner tpc-banner-ok" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="tpc-banner tpc-banner-err" role="alert">
          {error}
        </div>
      )}

      {!current ? (
        <p role="status" className="app-muted">
          Đang tải đề tài...
        </p>
      ) : current.items.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đề tài</h2>
          <p>
            {current.round.canSubmit
              ? 'Bấm “Thêm đề tài” để gửi đề tài đầu tiên vào đợt.'
              : 'Bạn chưa gửi đề tài nào trong đợt này.'}
          </p>
        </section>
      ) : (
        <div className="tpc-tablebox">
          <table
            className="tpc-table tpc-table-compact"
            aria-label="Đề tài của tôi"
          >
            <thead>
              <tr>
                <th scope="col">Đề tài</th>
                <th scope="col">Lĩnh vực</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {current.items.map((topic) => (
                <tr key={topic.id}>
                  <td>
                    <div className="tpc-cell-title">
                      <strong>{topic.title}</strong>
                      <span className="tpc-sub">
                        {topic.code} · {topic.description}
                      </span>
                    </div>
                  </td>
                  <td>{topic.field}</td>
                  <td>
                    <TopicStatusChip status={topic.status} />
                  </td>
                  <td>
                    <div className="tpc-row-actions">
                      {topic.canEdit !== 'none' && (
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          aria-label={`Sửa ${topic.title}`}
                          onClick={() => {
                            setNotice(null);
                            setDialog({ kind: 'edit', topic });
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Sửa
                        </button>
                      )}
                      {topic.canDelete && (
                        <button
                          type="button"
                          className="tpc-btn tpc-btn-sm"
                          aria-label={`Xóa ${topic.title}`}
                          onClick={() => {
                            setNotice(null);
                            setDialog({ kind: 'delete', topic });
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'create' && (
        <TopicForm
          topic={null}
          contentOnly={false}
          onCancel={() => setDialog(null)}
          onSubmit={async (input) => {
            await service.create(roundId, input);
            await afterChange('Đã gửi đề tài.');
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <TopicForm
          topic={dialog.topic}
          contentOnly={dialog.topic.canEdit === 'content'}
          onCancel={() => setDialog(null)}
          onSubmit={async (input) => {
            await service.update(dialog.topic.id, input);
            await afterChange('Đã lưu đề tài.');
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDelete
          topic={dialog.topic}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await service.remove(dialog.topic.id);
            await afterChange('Đã xóa đề tài.');
          }}
        />
      )}
    </div>
  );
};
