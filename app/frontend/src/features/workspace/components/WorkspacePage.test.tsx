import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import {
  currentUrl,
  replace,
  resetNavigation,
  setUrl,
} from '@/test/navigationMock';
import {
  type WorkspaceData,
  type WorkspaceService,
  WorkspaceNotFoundError,
} from '@/features/workspace/services/workspaceService';
import { WorkspacePage } from './WorkspacePage';
import type { Outline } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTopic: TopicDetailDto = {
  id: 'top-1',
  roundId: 'rnd-1',
  code: 'SE101',
  title: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
  status: 'Đang thực hiện',
  description: 'Mô tả chi tiết đề tài',
  requirements: 'Yêu cầu kỹ thuật chi tiết',
  field: 'Kỹ thuật phần mềm',
  source: 'GV công bố',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: null,
  canEdit: 'none',
  canDelete: false,
  outlineApprovedAt: '2026-03-02T10:00:00Z',
  supervisor: {
    id: 'gv-1',
    code: 'GV001',
    name: 'TS. Nguyễn Văn A',
    email: 'nva@fit.edu.vn',
  },
  round: {
    id: 'rnd-1',
    name: 'Khóa luận tốt nghiệp HK1 2026–2027',
    status: 'Đang diễn ra',
  },
  group: [
    {
      id: 'sv-1',
      name: 'Trần Văn B',
      code: '21520001',
      className: 'KTPM2021',
      representative: true,
      email: 'tvb@gm.uit.edu.vn',
    },
    {
      id: 'sv-2',
      name: 'Lê Thị Thu',
      code: '21520002',
      className: 'KTPM2021',
      representative: false,
      email: null,
    },
  ],
  submissions: [],
  history: [],
};

// Mở rộng mockTopic với reviewer và defense cho aside
(mockTopic as unknown as Record<string, unknown>).reviewer = {
  id: 'gv-2',
  code: 'GV002',
  name: 'ThS. Trần Thị C',
  email: 'ttc@fit.edu.vn',
};
(mockTopic as unknown as Record<string, unknown>).defense = {
  council: 'Hội đồng KTPM 01',
  councilPublished: true,
  chair: 'PGS. TS. Lê Văn D',
  secretary: 'TS. Phạm Văn E',
  start: '2026-06-15T08:30:00Z',
  room: 'Phòng B1.05',
  order: 1,
};

const mockApprovedOutline: Outline = {
  topicId: 'top-1',
  topicCode: 'SE101',
  topicTitle: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
  viewerRole: 'member',
  deadline: '2026-03-15',
  lateDeadline: '',
  approvedAt: '2026-03-02T10:00:00Z',
  approvedBy: 'TS. Nguyễn Văn A',
  approvedVersionNo: 1,
  currentSubmissionId: null,
  canSubmit: false,
  submitBlockedReason: 'Đề cương đã được duyệt.',
  canReview: false,
  canApprove: false,
  approveBlockedReason: null,
  submissions: [
    {
      id: 'sub-1',
      versionNo: 1,
      fileName: 'de-cuong.pdf',
      sizeBytes: 1024,
      note: 'Bản nộp đầu tiên',
      submittedBy: 'Trần Văn B',
      submittedAt: '2026-03-01T08:00:00Z',
      late: false,
      reviewComment: 'Đề cương đạt yêu cầu.',
      reviewedBy: 'TS. Nguyễn Văn A',
      reviewedAt: '2026-03-02T10:00:00Z',
      addressedRequestIds: [],
    },
  ],
  requests: [],
};

const mockPendingOutline: Outline = {
  ...mockApprovedOutline,
  approvedAt: null,
  approvedBy: null,
  approvedVersionNo: null,
  canSubmit: true,
  submitBlockedReason: null,
  submissions: [
    {
      ...mockApprovedOutline.submissions[0],
      reviewComment: null,
      reviewedBy: null,
      reviewedAt: null,
    },
  ],
};

const mockSubmissions: TopicSubmissions = {
  topicId: 'top-1',
  maxBytes: 52428800,
  kinds: [
    {
      kind: 'midterm',
      name: 'Báo cáo giữa kỳ',
      deadline: '2026-04-15',
      allowLate: false,
      lateDeadline: '',
      window: 'onTime',
      canSubmit: true,
      blockedReason: null,
      noteRequired: false,
      canReview: false,
      canLock: false,
      lockBlockedReason: null,
      extensionDeadline: '',
      extensionReason: null,
      waitingException: false,
      canGrantExtension: false,
      canMarkIneligible: false,
      ineligibleReason: null,
      versions: [],
      requests: [],
    },
    {
      kind: 'final',
      name: 'Báo cáo cuối kỳ',
      deadline: '2026-05-30',
      allowLate: false,
      lateDeadline: '',
      window: 'closed',
      canSubmit: false,
      blockedReason: null,
      noteRequired: false,
      canReview: false,
      canLock: false,
      lockBlockedReason: null,
      extensionDeadline: '',
      extensionReason: null,
      waitingException: false,
      canGrantExtension: false,
      canMarkIneligible: false,
      ineligibleReason: null,
      versions: [],
      requests: [],
    },
  ],
};

function createMockService(
  overrides?: Partial<WorkspaceData>,
): WorkspaceService {
  const data: WorkspaceData = {
    topic: mockTopic,
    outline: mockApprovedOutline,
    outlineError: null,
    submissions: mockSubmissions,
    submissionsError: null,
    viewerRole: 'member',
    canCancel: false,
    ...overrides,
  };

  return {
    load: vi.fn().mockResolvedValue(data),
    cancelRegistration: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WorkspacePage', () => {
  beforeEach(() => {
    resetNavigation('/de-tai/top-1');
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('hiển thị trạng thái loading khi đang tải dữ liệu', () => {
    const service: WorkspaceService = {
      load: () => new Promise(() => {}),
      cancelRegistration: vi.fn(),
    };

    render(<WorkspacePage topicId="top-1" service={service} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải đề tài…');
  });

  it('hiển thị không tìm thấy đề tài khi service ném WorkspaceNotFoundError', async () => {
    const service: WorkspaceService = {
      load: vi.fn().mockRejectedValue(new WorkspaceNotFoundError()),
      cancelRegistration: vi.fn(),
    };

    render(<WorkspacePage topicId="top-unknown" service={service} />);
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đề tài' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Đề tài không tồn tại hoặc bạn không có quyền xem đề tài này.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang danh sách đề tài' }),
    ).toHaveAttribute('href', '/sv/dang-ky');
  });

  it('R2: hiển thị link về trang nhóm hướng dẫn khi giảng viên gặp màn không tìm thấy đề tài', async () => {
    setUrl('/gv/huong-dan/top-unknown');
    const service: WorkspaceService = {
      load: vi.fn().mockRejectedValue(new WorkspaceNotFoundError()),
      cancelRegistration: vi.fn(),
    };

    render(<WorkspacePage topicId="top-unknown" service={service} />);
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đề tài' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang nhóm hướng dẫn' }),
    ).toHaveAttribute('href', '/gv/huong-dan');
  });

  it('R2: hiển thị link về danh sách đề tài khi giáo vụ gặp màn không tìm thấy đề tài', async () => {
    setUrl('/giao-vu/de-tai/top-unknown');
    const service: WorkspaceService = {
      load: vi.fn().mockRejectedValue(new WorkspaceNotFoundError()),
      cancelRegistration: vi.fn(),
    };

    render(<WorkspacePage topicId="top-unknown" service={service} />);
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đề tài' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về danh sách đề tài' }),
    ).toHaveAttribute('href', '/giao-vu/de-tai');
  });

  it('tải thành công và mặc định hiển thị tab Hoạt động', async () => {
    const service = createMockService();
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    // Header metadata
    expect(screen.getByText('SE101')).toBeInTheDocument();
    expect(screen.getByText('Đang thực hiện')).toBeInTheDocument();
    expect(
      screen.getByText(/Khóa luận tốt nghiệp HK1 2026–2027/),
    ).toBeInTheDocument();

    // Khung tiến độ 6 chặng
    expect(
      screen.getByRole('region', { name: 'Tiến độ thực hiện đề tài' }),
    ).toBeInTheDocument();

    // Tab mặc định là Hoạt động
    const activeTab = screen.getByRole('tab', { name: /Hoạt động/ });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');

    // Cột phụ aside ở tab Hoạt động hiển thị GVPB và Hội đồng (GVHD ở tab Tổng quan theo PDR-061)
    expect(screen.getByText('ThS. Trần Thị C')).toBeInTheDocument();
    expect(screen.getByText('Hội đồng KTPM 01')).toBeInTheDocument();
  });

  it('nút Hủy ghi danh xuất hiện khi canCancel = true và mở hộp thoại xác nhận hủy', async () => {
    const service = createMockService({ canCancel: true });
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    const cancelBtn = screen.getByRole('button', { name: 'Hủy ghi danh' });
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    // Hộp thoại xác nhận mở ra
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: 'Hủy ghi danh đề tài?' }),
    ).toBeInTheDocument();

    // Xác nhận hủy
    const confirmBtn = within(dialog).getByRole('button', {
      name: 'Hủy ghi danh',
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(service.cancelRegistration).toHaveBeenCalledWith('top-1');
      expect(toast.success).toHaveBeenCalledWith(
        'Đã hủy ghi danh đề tài SE101.',
      );
      expect(replace).toHaveBeenCalledWith('/sv/de-tai');
    });
  });

  it('nút Hủy ghi danh không xuất hiện khi canCancel = false', async () => {
    const service = createMockService({ canCancel: false });
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    expect(
      screen.queryByRole('button', { name: 'Hủy ghi danh' }),
    ).not.toBeInTheDocument();
  });

  it('chuyển tab bằng click chuột và đồng bộ query ?tab=', async () => {
    const service = createMockService();
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    // Chuyển sang tab Tổng quan
    const overviewTab = screen.getByRole('tab', { name: /Tổng quan/ });
    fireEvent.click(overviewTab);

    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(currentUrl()).toContain('tab=tong-quan');

    // Nội dung tab Tổng quan
    expect(screen.getByText('Mô tả đề tài')).toBeInTheDocument();
    expect(screen.getByText('Mô tả chi tiết đề tài')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu kỹ thuật chi tiết')).toBeInTheDocument();

    // Chuyển sang tab Thông báo
    const noticeTab = screen.getByRole('tab', { name: 'Thông báo' });
    fireEvent.click(noticeTab);

    expect(noticeTab).toHaveAttribute('aria-selected', 'true');
    expect(currentUrl()).toContain('tab=thong-bao');
    expect(
      screen.getByText(/Chưa có thông báo cho đề tài này/),
    ).toBeInTheDocument();

    // Chuyển sang tab Điểm số
    const scoresTab = screen.getByRole('tab', { name: 'Điểm số' });
    fireEvent.click(scoresTab);

    expect(scoresTab).toHaveAttribute('aria-selected', 'true');
    expect(currentUrl()).toContain('tab=diem-so');
  });

  it('hỗ trợ điều hướng tab bằng phím (ArrowRight, ArrowLeft, Home, End)', async () => {
    const service = createMockService();
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    // Bắt đầu ở tab Hoạt động (index 2: [0: Tổng quan, 1: Thông báo, 2: Hoạt động, 3: Điểm số])
    const actTab = screen.getByRole('tab', { name: /Hoạt động/ });
    actTab.focus();

    // ArrowRight -> Điểm số
    fireEvent.keyDown(actTab, { key: 'ArrowRight' });
    const scTab = screen.getByRole('tab', { name: 'Điểm số' });
    expect(scTab).toHaveFocus();
    expect(scTab).toHaveAttribute('aria-selected', 'true');

    // ArrowRight tiếp theo vòng về Tổng quan
    fireEvent.keyDown(scTab, { key: 'ArrowRight' });
    const ovTab = screen.getByRole('tab', { name: /Tổng quan/ });
    expect(ovTab).toHaveFocus();
    expect(ovTab).toHaveAttribute('aria-selected', 'true');

    // End -> Điểm số
    fireEvent.keyDown(ovTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Điểm số' })).toHaveFocus();

    // Home -> Tổng quan
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Điểm số' }), {
      key: 'Home',
    });
    expect(screen.getByRole('tab', { name: /Tổng quan/ })).toHaveFocus();
  });

  it('rơi về tab mặc định hoat-dong khi URL có param ?tab= không hợp lệ', async () => {
    setUrl('/de-tai/top-1?tab=la-lung');
    const service = createMockService();
    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    const actTab = screen.getByRole('tab', { name: /Hoạt động/ });
    expect(actTab).toHaveAttribute('aria-selected', 'true');
  });

  it('khi đề cương chưa duyệt: khóa khối Giữa kỳ & Cuối kỳ kèm ghi chú', async () => {
    setUrl('/de-tai/top-1?tab=hoat-dong');
    const service = createMockService({
      topic: { ...mockTopic, outlineApprovedAt: null },
      outline: mockPendingOutline,
    });

    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    // Mở accordion Báo cáo giữa kỳ trong tabpanel để kiểm tra thông báo khóa
    const panel = screen.getByRole('tabpanel', { name: 'Hoạt động' });
    const midtermHeader = within(panel).getByRole('button', {
      name: /^Báo cáo giữa kỳ/,
    });
    fireEvent.click(midtermHeader);

    expect(
      within(panel).getByText(
        /Mục nộp báo cáo giữa kỳ mở sau khi giảng viên hướng dẫn duyệt đề cương/i,
      ),
    ).toBeInTheDocument();
  });

  it('tab Điểm số: Sinh viên không thấy nhãn SINH VIÊN KHÔNG THẤY', async () => {
    setUrl('/de-tai/top-1?tab=diem-so');
    const service = createMockService({
      viewerRole: 'member',
    });

    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    expect(screen.queryByText(/SINH VIÊN KHÔNG THẤY/i)).not.toBeInTheDocument();
  });

  it('tab Điểm số: Giảng viên và Giáo vụ thấy banner SINH VIÊN KHÔNG THẤY và 3 thẻ chấm điểm', async () => {
    setUrl('/de-tai/top-1?tab=diem-so');
    const service = createMockService({
      viewerRole: 'supervisor',
    });

    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    expect(screen.getByText(/SINH VIÊN KHÔNG THẤY/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Chấm điểm hướng dẫn' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Chấm điểm phản biện' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Điểm hội đồng' }),
    ).toBeInTheDocument();
  });

  it('hiển thị cảnh báo lỗi bài nộp nếu submissionsError tồn tại mà không làm crash cả trang', async () => {
    setUrl('/de-tai/top-1?tab=hoat-dong');
    const service = createMockService({
      submissions: null,
      submissionsError: 'Không thể kết nối đến máy chủ lưu trữ tệp.',
    });

    render(<WorkspacePage topicId="top-1" service={service} />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
    });

    expect(
      screen.getByText('Không thể kết nối đến máy chủ lưu trữ tệp.'),
    ).toBeInTheDocument();
  });
});
