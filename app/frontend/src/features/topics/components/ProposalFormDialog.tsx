'use client';

import React, { useState } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import type {
  ProposalInput,
  ProposalUpdateInput,
  TopicDetailDto,
  TopicPerson,
} from '@/types/topic';

interface ProposalFormDialogProps {
  roundId: string;
  proposal?: TopicDetailDto;
  supervisors: TopicPerson[];
  existingGroup: boolean;
  onClose: () => void;
  onSubmit: (input: ProposalInput | ProposalUpdateInput) => Promise<void>;
}

type Values = {
  title: string;
  field: string;
  description: string;
  requirements: string;
  supervisorId: string;
  memberCode: string;
};

type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const initialValues = (proposal?: TopicDetailDto): Values => ({
  title: proposal?.title ?? '',
  field: proposal?.field ?? '',
  description: proposal?.description ?? '',
  requirements: proposal?.requirements ?? '',
  supervisorId: proposal?.supervisor.id ?? '',
  memberCode: '',
});

const errorText = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : 'Không lưu được đề xuất. Thử lại sau.';

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.title.trim()) errors.title = 'Nhập tên đề tài.';
  if (!values.field.trim()) errors.field = 'Nhập lĩnh vực.';
  if (!values.description.trim()) errors.description = 'Nhập mô tả đề tài.';
  if (!values.supervisorId) errors.supervisorId = 'Chọn giảng viên hướng dẫn.';
  return errors;
}

// Form dùng cho cả tạo mới, gửi lại bằng nhóm đã giữ, và sửa đơn còn chờ.
// Mã thành viên chỉ xuất hiện lúc tạo nhóm lần đầu; backend vẫn là nơi xác thực mã.
export const ProposalFormDialog: React.FC<ProposalFormDialogProps> = ({
  roundId,
  proposal,
  supervisors,
  existingGroup,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState<Values>(() => initialValues(proposal));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const editing = !!proposal;

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || saving) return;
    setSaving(true);
    try {
      const common = {
        title: values.title,
        field: values.field,
        description: values.description,
        requirements: values.requirements,
        supervisorId: values.supervisorId,
      };
      await onSubmit(
        editing
          ? common
          : {
              ...common,
              roundId,
              memberCodes:
                existingGroup || !values.memberCode.trim()
                  ? []
                  : [values.memberCode.trim()],
            },
      );
    } catch (error: unknown) {
      setServerError(errorText(error));
      setSaving(false);
    }
  };

  const field = (
    name: Extract<Field, 'title' | 'field' | 'description' | 'requirements'>,
    label: string,
    multiline = false,
    required = false,
  ) => {
    const id = `proposal-${name}`;
    const errorId = `${id}-error`;
    return (
      <div className="tpc-form-field">
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {multiline ? (
          <textarea
            id={id}
            rows={name === 'description' ? 5 : 3}
            value={values[name]}
            disabled={saving}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? errorId : undefined}
            onChange={(event) => set(name, event.target.value)}
          />
        ) : (
          <input
            id={id}
            value={values[name]}
            disabled={saving}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? errorId : undefined}
            onChange={(event) => set(name, event.target.value)}
          />
        )}
        {errors[name] && (
          <p id={errorId} className="tpc-form-error">
            {errors[name]}
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
        aria-labelledby="proposal-form-title"
        onKeyDown={(event) => event.key === 'Escape' && !saving && onClose()}
      >
        <h2 id="proposal-form-title">
          {editing ? `Sửa đề xuất ${proposal.code}` : 'Đề xuất đề tài mới'}
        </h2>
        {!editing && existingGroup && (
          <p className="tpc-dialog-warn">
            Đề xuất sẽ dùng lại nhóm hiện có, gồm đúng các thành viên và đại
            diện đã được giữ.
          </p>
        )}
        {serverError && (
          <p className="tpc-dialog-err" role="alert">
            {serverError}
          </p>
        )}
        <form className="tpc-form" onSubmit={submit} noValidate>
          {field('title', 'Tên đề tài', false, true)}
          {field('field', 'Lĩnh vực', false, true)}
          {field('description', 'Mô tả', true, true)}
          {field('requirements', 'Yêu cầu', true)}
          <div className="tpc-form-field">
            <label htmlFor="proposal-supervisor">
              Giảng viên hướng dẫn <span aria-hidden="true">*</span>
            </label>
            <select
              id="proposal-supervisor"
              className="tpc-select"
              value={values.supervisorId}
              disabled={saving || supervisors.length === 0}
              aria-invalid={errors.supervisorId ? true : undefined}
              aria-describedby={
                errors.supervisorId ? 'proposal-supervisor-error' : undefined
              }
              onChange={(event) => set('supervisorId', event.target.value)}
            >
              <option value="">Chọn giảng viên</option>
              {supervisors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.code} · {person.name}
                </option>
              ))}
            </select>
            {errors.supervisorId && (
              <p id="proposal-supervisor-error" className="tpc-form-error">
                {errors.supervisorId}
              </p>
            )}
          </div>
          {!editing && !existingGroup && (
            <div className="tpc-form-field">
              <label htmlFor="proposal-member">
                Mã số sinh viên thành viên thứ hai
              </label>
              <input
                id="proposal-member"
                value={values.memberCode}
                disabled={saving}
                onChange={(event) => set('memberCode', event.target.value)}
              />
              <p className="tpc-hint">
                Để trống nếu làm một mình. Mã được kiểm tra khi gửi đề xuất.
              </p>
            </div>
          )}
          <div className="tpc-dialog-actions">
            <button
              type="button"
              className="tpc-btn"
              disabled={saving}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="tpc-btn tpc-btn-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving
                ? 'Đang lưu...'
                : editing
                  ? 'Lưu thay đổi'
                  : 'Gửi đề xuất'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
