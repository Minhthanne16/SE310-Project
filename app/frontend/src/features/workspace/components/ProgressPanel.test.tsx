import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProgressRow } from '@/features/workspace/workspaceProgress';
import { ProgressPanel } from './ProgressPanel';

afterEach(cleanup);

const mockRows: ProgressRow[] = [
  {
    key: 'registration',
    label: 'ĐĂNG KÝ',
    steps: [{ text: 'Đã ghi danh', kind: 'done' }],
  },
  {
    key: 'outline',
    label: 'ĐỀ CƯƠNG',
    note: 'Hạn nộp 20/10/2026',
    steps: [{ text: 'Chưa nộp', kind: 'now' }],
  },
  {
    key: 'midterm',
    label: 'GIỮA KỲ',
    note: 'Mở sau khi đề cương được duyệt',
    steps: [{ text: 'Chưa mở', kind: 'todo' }],
  },
  {
    key: 'final',
    label: 'CUỐI KỲ',
    steps: [{ text: 'Chưa mở', kind: 'todo' }],
  },
  {
    key: 'evaluation',
    label: 'ĐÁNH GIÁ',
    parallel: true,
    steps: [
      { text: 'Điểm hướng dẫn', kind: 'todo' },
      { text: 'Điểm phản biện', kind: 'todo' },
      { text: 'Điểm hội đồng', kind: 'todo' },
    ],
  },
  {
    key: 'result',
    label: 'KẾT QUẢ',
    steps: [
      { text: 'Đã cho điểm', kind: 'todo' },
      { text: 'Xác nhận kết quả', kind: 'todo' },
      { text: 'Công bố · hoàn tất', kind: 'todo' },
    ],
  },
];

describe('ProgressPanel', () => {
  it('renders all rows when expanded and supports toggle collapse/expand', () => {
    render(<ProgressPanel rows={mockRows} />);

    expect(
      screen.getByRole('heading', { name: 'TIẾN ĐỘ' }),
    ).toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: /thu gọn/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Mở: thấy các nhãn hàng
    expect(screen.getByText('ĐĂNG KÝ')).toBeInTheDocument();
    expect(screen.getByText('ĐỀ CƯƠNG')).toBeInTheDocument();
    expect(screen.getByText('GIỮA KỲ')).toBeInTheDocument();
    expect(screen.getByText('(Hạn nộp 20/10/2026)')).toBeInTheDocument();

    // Bấm thu gọn
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveTextContent(/mở rộng/i);

    // Chế độ thu gọn: chặng hiện tại hiển thị tên chặng kèm bước chờ
    expect(screen.getByText('Đề cương · Chưa nộp')).toBeInTheDocument();

    // Bấm mở rộng lại
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('ĐĂNG KÝ')).toBeInTheDocument();
  });

  it('renders a role="note" banner when noGroup is true', () => {
    render(<ProgressPanel rows={[]} noGroup={true} />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Đề tài không có nhóm sau hạn đăng ký.');
    expect(
      screen.queryByRole('button', { name: /thu gọn/i }),
    ).not.toBeInTheDocument();
  });
});
