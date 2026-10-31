import type { UserRole } from '@/types/auth';

// Đối tượng của menu chuông (prop `audience` của ThongBaoMenu).
export type NotificationAudience = 'sv' | 'gv' | 'giaovu';

export type NotificationKind =
  | 'assign'
  | 'success'
  | 'reject'
  | 'schedule'
  | 'comment'
  | 'deadline'
  | 'result'
  | 'inbox'
  | 'post';

export interface BellNotification {
  id: string;
  group: 'today' | 'earlier';
  kind: NotificationKind;
  text: string;
  from: string;
  time: string;
  href: string;
  unread: boolean;
}

export interface NotificationService {
  list(audience: NotificationAudience): Promise<BellNotification[]>;
  markRead(ids: string[]): Promise<void>;
}

export const audienceOf = (role: UserRole): NotificationAudience =>
  role === 'Student' ? 'sv' : role === 'Lecturer' ? 'gv' : 'giaovu';

type Row = [
  id: string,
  group: 'today' | 'earlier',
  kind: NotificationKind,
  text: string,
  from: string,
  time: string,
  href: string,
  unread: boolean,
];

// DEMO: backend chưa có API thông báo (đề xuất GET /api/notifications/me và
// POST /api/notifications/read). Nội dung lấy từ artboard ThongBaoMenu, các chỗ
// giữ chỗ ([n], [dd/mm]...) đã điền số mẫu. Đã đọc chỉ nằm trong bộ nhớ.
const DEMO_ROWS: Record<NotificationAudience, Row[]> = {
  sv: [
    [
      's1',
      'today',
      'assign',
      'Giáo vụ đã phân công giảng viên phản biện và hội đồng cho khóa luận của bạn.',
      'Giáo vụ Khoa',
      '15 phút trước',
      '/sv/de-tai',
      true,
    ],
    [
      's2',
      'today',
      'success',
      'Giảng viên hướng dẫn đã chấp nhận đề xuất "Ứng dụng quản lý chi tiêu cá nhân". Đề tài đã được đăng ký.',
      'TS. Phạm Quốc Bảo',
      '2 giờ trước',
      '/sv/don-dang-ky',
      true,
    ],
    [
      's3',
      'today',
      'deadline',
      'Còn 3 ngày đến hạn nộp bản cuối. Nhớ chốt bản cuối trước hạn, quá hạn hệ thống tự lấy bản mới nhất.',
      'Hệ thống',
      '8 giờ trước',
      '/sv/de-tai',
      true,
    ],
    [
      's8',
      'earlier',
      'post',
      'GV Trần Minh Khoa đăng bài mới trên Bảng thông báo: "Họp nhóm hướng dẫn tuần 7".',
      'TS. Trần Minh Khoa',
      'Hôm qua, 20:15',
      '/sv',
      true,
    ],
    [
      's4',
      'earlier',
      'reject',
      'Đơn đề xuất đề tài "Game giáo dục cho học sinh tiểu học" của bạn đã bị từ chối. Xem lý do.',
      'ThS. Lê Thu Hà',
      '12/10',
      '/sv/don-dang-ky',
      false,
    ],
    [
      's7',
      'earlier',
      'success',
      'Giảng viên hướng dẫn đã chấp nhận đề xuất "Xây dựng hệ thống đặt lịch khám bệnh trực tuyến". Đề tài đã được đăng ký.',
      'TS. Trần Minh Khoa',
      '10/10',
      '/sv/de-tai',
      false,
    ],
    [
      's5',
      'earlier',
      'comment',
      'Giảng viên hướng dẫn đã thêm yêu cầu chỉnh sửa đề cương.',
      'TS. Trần Minh Khoa',
      '08/10',
      '/sv/de-tai',
      false,
    ],
    [
      's6',
      'earlier',
      'schedule',
      'Đã có lịch bảo vệ: Thứ Sáu, 16/01 lúc 08:30, phòng B3.02.',
      'Giáo vụ Khoa',
      '05/10',
      '/sv/de-tai',
      false,
    ],
  ],
  gv: [
    [
      'g1',
      'today',
      'inbox',
      'Sinh viên Đặng Thu Hạnh đã gửi đề xuất đề tài và chọn bạn hướng dẫn.',
      'Đặng Thu Hạnh',
      '10 phút trước',
      '/gv/de-xuat',
      true,
    ],
    [
      'g2',
      'today',
      'assign',
      'Giáo vụ đã phân công bạn phản biện đề tài "Nền tảng học trực tuyến với Blazor".',
      'Giáo vụ Khoa',
      '1 giờ trước',
      '/gv/phan-bien',
      true,
    ],
    [
      'g3',
      'today',
      'comment',
      'Nhóm Nguyễn Văn An đã nộp đề cương, chờ bạn duyệt.',
      'Nguyễn Văn An',
      '3 giờ trước',
      '/gv/de-tai',
      false,
    ],
    [
      'g6',
      'today',
      'deadline',
      'Điểm GV phản biện đề tài DT-03 lệch từ 2 điểm so với điểm hội đồng. Hội đồng vui lòng xem lại điểm.',
      'Hệ thống',
      '4 giờ trước',
      '/gv/de-tai',
      false,
    ],
    [
      'g7',
      'earlier',
      'post',
      'Giáo vụ Khoa đăng bài mới trên Bảng thông báo: "Nhắc giảng viên duyệt đề cương".',
      'Giáo vụ Khoa',
      '11/10',
      '/gv',
      false,
    ],
    [
      'g4',
      'earlier',
      'schedule',
      'Bạn được thêm vào Hội đồng 2 với vai trò Thư ký. Lịch: Thứ Sáu, 16/01, phòng B3.02.',
      'Giáo vụ Khoa',
      '09/10',
      '/gv/hoi-dong',
      false,
    ],
    [
      'g5',
      'earlier',
      'comment',
      'Nhóm Nguyễn Văn An đã tải lên phiên bản 3 của khóa luận: "Sửa lỗi trình bày chương 3".',
      'Hệ thống',
      '07/10',
      '/gv/de-tai',
      false,
    ],
  ],
  giaovu: [
    [
      'v1',
      'today',
      'deadline',
      'Hạn giảng viên gửi đề tài kết thúc hôm nay. Bạn có thể đóng và công bố danh sách.',
      'Hệ thống',
      '30 phút trước',
      '/giao-vu/de-tai',
      true,
    ],
    [
      'v2',
      'today',
      'result',
      'Đề tài DT-02 đã đủ điểm, chờ xác nhận kết quả.',
      'Hệ thống',
      '2 giờ trước',
      '/giao-vu/ket-qua',
      true,
    ],
    [
      'v5',
      'today',
      'inbox',
      'TS. Phạm Quốc Bảo đã chấp nhận đề xuất "Ứng dụng quản lý chi tiêu cá nhân". Cảnh báo: giảng viên đã vượt số đề tài tối đa của đợt (6/5).',
      'Hệ thống',
      '1 giờ trước',
      '/giao-vu/de-tai',
      true,
    ],
    [
      'v6',
      'earlier',
      'success',
      'Nhóm đề tài DT-02 đã chốt bản cuối, sẵn sàng xác nhận và công bố kết quả.',
      'Hệ thống',
      '12/10',
      '/giao-vu/ket-qua',
      false,
    ],
    [
      'v3',
      'earlier',
      'assign',
      '4 đề tài đang thực hiện chưa được phân công phản biện.',
      'Hệ thống',
      '10/10',
      '/giao-vu/phan-bien',
      false,
    ],
    [
      'v4',
      'earlier',
      'comment',
      'Nhập Excel người dùng hoàn tất: 118 dòng thành công, 2 dòng lỗi.',
      'Hệ thống',
      '08/10',
      '/giao-vu/nguoi-dung',
      false,
    ],
  ],
};

export function createNotificationService(): NotificationService {
  const read = new Set<string>();
  return {
    async list(audience) {
      return DEMO_ROWS[audience].map(
        ([id, group, kind, text, from, time, href, unread]) => ({
          id,
          group,
          kind,
          text,
          from,
          time,
          href,
          unread: unread && !read.has(id),
        }),
      );
    },
    async markRead(ids) {
      ids.forEach((id) => read.add(id));
    },
  };
}

export const notificationService: NotificationService =
  createNotificationService();
