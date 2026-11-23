'use client';

import React, { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { displayDateToIso, isoToDisplayDate, maskDateTyping } from '@/lib/date';

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
>;

interface DateInputProps extends NativeInputProps {
  // Ngày dạng yyyy-MM-dd; chuỗi rỗng khi chưa đặt.
  value: string;
  // Nhận yyyy-MM-dd khi người dùng nhập đủ một ngày hợp lệ, chuỗi rỗng khi ô
  // trống hoặc ngày đang gõ dở/không có thật.
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

// Ô nhập ngày dùng chung: luôn hiển thị và nhận gõ theo dd/MM/yyyy, không phụ
// thuộc ngôn ngữ trình duyệt như <input type="date">; dữ liệu ra vào vẫn là
// yyyy-MM-dd. Nút lịch mở bộ chọn ngày của trình duyệt qua một ô date ẩn.
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  min,
  max,
  inputRef,
  className,
  disabled,
  readOnly,
  placeholder = 'dd/mm/yyyy',
  size = 12,
  ...rest
}) => {
  const [text, setText] = useState(() => isoToDisplayDate(value));
  const [syncedValue, setSyncedValue] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Giá trị đổi từ ngoài (bộ chọn, Hủy thay đổi, tải lại) thì cập nhật chữ,
  // trừ khi chữ đang gõ đã tương ứng với giá trị đó.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (displayDateToIso(text) !== value) setText(isoToDisplayDate(value));
  }

  const emit = (iso: string) => {
    if (iso !== value) onChange(iso);
  };

  const handleType = (raw: string) => {
    const next = maskDateTyping(raw);
    setText(next);
    emit(displayDateToIso(next));
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
        return;
      }
    } catch {
      // Trình duyệt chặn showPicker: rơi xuống cách mở thông thường.
    }
    picker.focus();
    picker.click();
  };

  const editable = !disabled && !readOnly;
  const unparsable = text !== '' && displayDateToIso(text) === '';
  const ariaInvalid = rest['aria-invalid'] ?? (unparsable ? true : undefined);

  return (
    <span className={`app-date${editable ? ' app-date-has-picker' : ''}`}>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        size={size}
        placeholder={placeholder}
        className={`app-date-field${className ? ` ${className}` : ''}`}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={ariaInvalid}
        onChange={(e) => handleType(e.target.value)}
      />
      {editable && (
        <>
          <input
            ref={pickerRef}
            type="date"
            className="app-date-picker"
            tabIndex={-1}
            aria-hidden="true"
            value={value}
            min={min}
            max={max}
            onChange={(e) => emit(e.target.value)}
          />
          <button
            type="button"
            className="app-date-btn"
            aria-label={
              rest['aria-label']
                ? `Chọn ngày: ${rest['aria-label']}`
                : 'Chọn ngày'
            }
            onClick={openPicker}
          >
            <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </>
      )}
    </span>
  );
};
