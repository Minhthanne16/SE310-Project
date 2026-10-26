import {
  MILESTONE_DEFS,
  type Milestone,
  type Participant,
  type ParticipantKind,
  type Round,
  type RoundNotification,
  type TopicStatus,
  type TopicSummary,
} from '@/types/round';

// Ngày "hôm nay" cố định của dữ liệu demo (thứ Hai); dữ liệu mẫu tính quanh
// ngày này để màn hình luôn có đợt đang diễn ra, sắp tới và đã qua.
export const DEMO_TODAY = '2026-10-26';

type DatePair = [string, string] | null;

export function buildMilestones(dates: DatePair[]): Milestone[] {
  return MILESTONE_DEFS.map((def, index) => ({
    key: def.key,
    name: def.name,
    startDate: dates[index]?.[0] ?? '',
    endDate: dates[index]?.[1] ?? '',
    notifyAudience: 'Tất cả',
    allowLate: def.hasLateToggle ? true : null,
  }));
}

const lecturer = (code: string, name: string, unit: string): Participant => ({
  id: code,
  code,
  name,
  unit,
});

const student = (code: string, name: string, unit: string): Participant => ({
  id: code,
  code,
  name,
  unit,
});

export function seedParticipants(): Record<ParticipantKind, Participant[]> {
  return {
    lecturer: [
      lecturer('CB101', 'Nguyễn Thị Hương', 'Công nghệ phần mềm'),
      lecturer('CB102', 'Trần Quốc Bảo', 'Hệ thống thông tin'),
      lecturer('CB103', 'Vũ Đức Anh', 'Mạng máy tính'),
      lecturer('CB104', 'Lê Minh Tuấn', 'Khoa học máy tính'),
      lecturer('CB105', 'Phan Thị Lan', 'Công nghệ phần mềm'),
      lecturer('CB106', 'Đặng Văn Hải', 'An toàn thông tin'),
    ],
    student: [
      student('22520001', 'Nguyễn Văn An', 'KTPM2022'),
      student('22520002', 'Lê Thị Bình', 'KTPM2022'),
      student('22520003', 'Hoàng Gia Huy', 'HTTT2022'),
      student('22520004', 'Đỗ Thu Trang', 'ATTT2022'),
      student('22520005', 'Phạm Quốc Khánh', 'KTPM2022'),
      student('22520006', 'Bùi Thị Mai', 'HTTT2022'),
      student('22520007', 'Ngô Thanh Sơn', 'KHMT2022'),
      student('22520008', 'Trịnh Hoài Nam', 'KHMT2022'),
      student('22520009', 'Võ Ngọc Ánh', 'ATTT2022'),
      student('22520010', 'Đinh Công Minh', 'KTPM2021'),
      student('22520011', 'Lý Thùy Dung', 'HTTT2021'),
      student('22520012', 'Dương Quang Vinh', 'KTPM2021'),
    ],
  };
}

function topics(
  counts: Partial<Record<TopicStatus, number>>,
  unpublishedCount: number,
): TopicSummary {
  const byStatus: Record<TopicStatus, number> = {
    'Chưa đăng ký': 0,
    'Chờ GV duyệt': 0,
    'Đã đăng ký': 0,
    'Đang thực hiện': 0,
    'Đã cho điểm': 0,
    'Đã hoàn tất': 0,
    ...counts,
  };
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  return { total, unpublishedCount, byStatus };
}

// Bốn đợt mẫu của canvas (vb1, vb2, ths, vb1o) cộng một đợt Nháp.
export function seedRounds(): Round[] {
  const withAudience = (ms: Milestone[]): Milestone[] =>
    ms.map((m) => ({
      ...m,
      notifyAudience:
        m.key === 'topicSubmission'
          ? 'Giảng viên'
          : m.key === 'topicRegistration'
            ? 'Sinh viên'
            : 'Tất cả',
    }));

  return [
    {
      id: 'r-vb1-hk1',
      name: 'Văn bằng 1 · HK1 2026–2027',
      program: 'Văn bằng 1',
      periodLabel: 'HK1 2026–2027',
      status: 'Đang diễn ra',
      milestones: withAudience(
        buildMilestones([
          ['2026-09-07', '2026-09-18'],
          ['2026-09-21', '2026-10-02'],
          ['2026-10-05', '2026-10-16'],
          ['2026-10-19', '2026-10-30'],
          ['2026-11-23', '2026-12-04'],
          ['2026-12-07', '2026-12-11'],
          ['2026-12-14', '2026-12-23'],
          ['2026-12-21', '2026-12-31'],
          ['2027-01-04', '2027-01-15'],
        ]),
      ),
      lecturerIds: ['CB101', 'CB102', 'CB103'],
      studentIds: ['22520001', '22520002', '22520003', '22520004'],
      lockedStudentIds: ['22520001'],
      topicSummary: topics(
        { 'Đang thực hiện': 3, 'Chờ GV duyệt': 1, 'Chưa đăng ký': 2 },
        2,
      ),
    },
    {
      id: 'r-vb2-hk1',
      name: 'Văn bằng 2 · HK1 2026–2027',
      program: 'Văn bằng 2',
      periodLabel: 'HK1 2026–2027',
      status: 'Đang diễn ra',
      milestones: withAudience(
        buildMilestones([
          ['2026-09-14', '2026-09-25'],
          ['2026-09-28', '2026-10-09'],
          ['2026-10-12', '2026-11-06'],
          ['2026-11-09', '2026-11-27'],
          ['2026-11-30', '2026-12-18'],
          ['2026-12-21', '2026-12-25'],
          ['2027-01-04', '2027-01-15'],
          ['2027-01-11', '2027-01-22'],
          ['2027-01-25', '2027-02-05'],
        ]),
      ),
      lecturerIds: ['CB102', 'CB104'],
      studentIds: ['22520005', '22520006', '22520007'],
      lockedStudentIds: ['22520005'],
      topicSummary: topics({ 'Đã đăng ký': 2, 'Chờ GV duyệt': 1 }, 0),
    },
    {
      id: 'r-ths-1-2026',
      name: 'Thạc sĩ · Đợt 1/2026',
      program: 'Thạc sĩ',
      periodLabel: 'Đợt 1/2026',
      status: 'Đang diễn ra',
      milestones: withAudience(
        buildMilestones([
          ['2026-08-03', '2026-08-14'],
          ['2026-08-17', '2026-08-28'],
          ['2026-08-31', '2026-09-18'],
          ['2026-09-21', '2026-10-09'],
          ['2026-10-12', '2026-11-13'],
          ['2026-11-16', '2026-11-20'],
          ['2026-11-23', '2026-12-04'],
          ['2026-12-01', '2026-12-11'],
          ['2026-12-14', '2026-12-23'],
        ]),
      ),
      lecturerIds: ['CB101', 'CB105', 'CB106'],
      studentIds: ['22520008', '22520009'],
      lockedStudentIds: ['22520008'],
      topicSummary: topics({ 'Đang thực hiện': 2 }, 1),
    },
    {
      id: 'r-vb2-hk2-nhap',
      name: 'Văn bằng 2 · HK2 2026–2027',
      program: 'Văn bằng 2',
      periodLabel: 'HK2 2026–2027',
      status: 'Nháp',
      // Mới có hai mốc đầu có ngày: mở đợt sẽ hiện cảnh báo việc chưa xong.
      milestones: buildMilestones([
        ['2027-02-01', '2027-02-12'],
        ['2027-02-15', '2027-02-26'],
      ]),
      lecturerIds: ['CB103', 'CB104'],
      studentIds: [],
      lockedStudentIds: [],
      topicSummary: topics({}, 0),
    },
    {
      id: 'r-vb1-hk2-2025',
      name: 'Văn bằng 1 · HK2 2025–2026',
      program: 'Văn bằng 1',
      periodLabel: 'HK2 2025–2026',
      status: 'Đã kết thúc',
      milestones: withAudience(
        buildMilestones([
          ['2026-02-02', '2026-02-13'],
          ['2026-02-16', '2026-02-27'],
          ['2026-03-02', '2026-03-13'],
          ['2026-03-30', '2026-04-10'],
          ['2026-05-04', '2026-05-15'],
          ['2026-05-18', '2026-05-22'],
          ['2026-05-25', '2026-06-05'],
          ['2026-06-01', '2026-06-12'],
          ['2026-06-15', '2026-06-26'],
        ]),
      ),
      lecturerIds: ['CB101', 'CB103'],
      studentIds: ['22520010', '22520011', '22520012'],
      lockedStudentIds: ['22520010', '22520011', '22520012'],
      topicSummary: topics({ 'Đã hoàn tất': 3 }, 0),
    },
  ];
}

export function seedNotifications(): RoundNotification[] {
  const row = (
    id: string,
    roundId: string,
    createdAt: string,
    title: string,
    sender: string,
    source: RoundNotification['source'],
    mine: boolean,
    body: string,
  ): RoundNotification => ({
    id,
    roundId,
    createdAt,
    title,
    sender,
    source,
    mine,
    body,
  });
  const me = 'Phạm Minh Châu';
  return [
    row(
      'n-01',
      'r-vb1-hk1',
      '2026-10-26T08:30:00',
      'Nhắc hạn nộp báo cáo giữa kỳ',
      me,
      'Từ giáo vụ',
      true,
      'Hạn nộp báo cáo giữa kỳ là 30/10/2026. Nhóm nộp trễ cần báo giảng viên hướng dẫn.',
    ),
    row(
      'n-02',
      'r-vb1-hk1',
      '2026-10-23T14:10:00',
      'Cập nhật mẫu báo cáo giữa kỳ',
      'Lê Hoàng Nam',
      'Từ giáo vụ',
      false,
      'Mẫu báo cáo giữa kỳ đã được cập nhật phần đánh giá rủi ro. Dùng bản mới khi nộp.',
    ),
    row(
      'n-03',
      'r-vb1-hk1',
      '2026-10-20T09:00:00',
      'Lịch họp nhóm hướng dẫn tuần 8',
      'Nguyễn Thị Hương',
      'Từ giảng viên',
      false,
      'Các nhóm do cô hướng dẫn họp vào thứ Năm, 14:00, phòng B3.02.',
    ),
    row(
      'n-04',
      'r-vb1-hk1',
      '2026-10-16T16:45:00',
      'Hạn chót nộp đề cương',
      me,
      'Từ giáo vụ',
      true,
      'Hôm nay là hạn cuối nộp đề cương. Hệ thống vẫn nhận bài nộp trễ.',
    ),
    row(
      'n-05',
      'r-vb1-hk1',
      '2026-10-05T10:20:00',
      'Mở nộp đề cương',
      me,
      'Từ giáo vụ',
      true,
      'Sinh viên nộp đề cương tại mục Đề tài của tôi từ hôm nay đến 16/10/2026.',
    ),
    row(
      'n-06',
      'r-vb1-hk1',
      '2026-09-21T08:00:00',
      'Công bố danh sách đề tài',
      'Lê Hoàng Nam',
      'Từ giáo vụ',
      false,
      'Danh sách đề tài đã công bố. Sinh viên đăng ký đến hết 02/10/2026.',
    ),
    row(
      'n-07',
      'r-vb1-hk1',
      '2026-09-07T08:00:00',
      'Bắt đầu đợt khóa luận HK1 2026–2027',
      me,
      'Từ giáo vụ',
      true,
      'Đợt khóa luận đã mở. Giảng viên gửi đề tài trước 18/09/2026.',
    ),
    row(
      'n-08',
      'r-ths-1-2026',
      '2026-10-22T11:00:00',
      'Nhắc nộp báo cáo cuối kỳ',
      me,
      'Từ giáo vụ',
      true,
      'Báo cáo cuối kỳ nộp trước 13/11/2026.',
    ),
    row(
      'n-09',
      'r-ths-1-2026',
      '2026-10-12T09:30:00',
      'Hướng dẫn trình bày luận văn',
      'Phan Thị Lan',
      'Từ giảng viên',
      false,
      'Luận văn trình bày theo mẫu của khoa, tối đa 80 trang.',
    ),
    row(
      'n-10',
      'r-vb2-hk1',
      '2026-10-12T08:00:00',
      'Mở nộp đề cương đợt Văn bằng 2',
      me,
      'Từ giáo vụ',
      true,
      'Nộp đề cương từ 12/10 đến 06/11/2026.',
    ),
  ];
}
