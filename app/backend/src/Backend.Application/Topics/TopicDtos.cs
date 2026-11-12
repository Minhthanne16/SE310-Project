namespace Backend.Application.Topics;

// GV gửi hoặc sửa đề tài. RoundId chỉ dùng khi thêm; sửa thì bỏ qua.
public class TopicInputDto
{
    public Guid RoundId { get; set; }
    public string? Title { get; set; }
    public string? Field { get; set; }
    public string? Description { get; set; }
    public string? Requirements { get; set; }
}

public class TopicPersonDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class TopicDto
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Requirements { get; set; }
    public TopicPersonDto Supervisor { get; set; } = new();
    // GV công bố | SV đề xuất
    public string Source { get; set; } = string.Empty;
    // Nhãn trạng thái đã tính theo thời điểm hiện tại (PDR-049), trùng TOPIC_STATUSES ở frontend.
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    // Quyền của người xem: all (mọi trường) | content (mô tả, yêu cầu) | none.
    public string CanEdit { get; set; } = TopicEditScopes.None;
    public bool CanDelete { get; set; }
    // Nhóm đang nhận đề tài (đại diện trước). Sinh viên xem danh sách công bố không thấy nhóm khác.
    public List<GroupMemberDto> Group { get; set; } = [];
    // GVHD duyệt đề cương (PDR-013); không đổi trạng thái đề tài (PDR-049).
    public DateTime? OutlineApprovedAt { get; set; }
    // Chỉ có ở danh sách đề tài của GVHD (/api/topics/mine); null ở nơi khác.
    public OutlineSummaryDto? Outline { get; set; }
}

public class OutlineSummaryDto
{
    public int Versions { get; set; }
    public int OpenRequests { get; set; }
    // Phiên bản mới nhất đang chờ GVHD nhận xét, tạo yêu cầu hoặc duyệt (PDR-013).
    public bool AwaitingReview { get; set; }
}

public class GroupMemberDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public bool Representative { get; set; }
}

public class GroupDto
{
    public Guid Id { get; set; }
    public Guid RepresentativeId { get; set; }
    public List<GroupMemberDto> Members { get; set; } = [];
}

// Ghi danh nhóm; mã sinh viên thành viên thứ hai (không gồm người ghi danh). Nhóm đã có thì
// để trống hoặc gửi đúng thành viên hiện có (nhóm giữ nguyên theo PDR-047).
public class RegisterTopicDto
{
    public List<string>? MemberCodes { get; set; }
}

// Sinh viên gửi đề xuất; người gọi là đại diện khi nhóm chưa tồn tại hoặc đã được giữ từ đề xuất đã hủy.
public class ProposalInputDto : TopicInputDto
{
    public Guid SupervisorId { get; set; }
    public List<string>? MemberCodes { get; set; }
}

// Sửa khi đề xuất còn chờ; đổi GVHD sẽ chuyển đề xuất sang GV mới (REPORT_SPEC).
public class ProposalUpdateDto : TopicInputDto
{
    public Guid SupervisorId { get; set; }
}

public class RejectProposalDto
{
    public string? Reason { get; set; }
}

public class StudentProposalsDto
{
    public TopicRoundDto Round { get; set; } = new();
    public bool RegistrationOpen { get; set; }
    public GroupDto? Group { get; set; }
    // Gồm cả đề xuất Đã hủy để sinh viên tra cứu lịch sử PDR-012, mới nhất trước.
    public List<TopicDetailDto> Items { get; set; } = [];
}

public class LecturerProposalsDto
{
    public TopicRoundDto Round { get; set; } = new();
    // Chờ duyệt và các đề xuất đã xử lý/lịch sử, mới nhất trước.
    public List<TopicDetailDto> Items { get; set; } = [];
    public LecturerLoadDto Load { get; set; } = new();
}

public class RegistrationHistoryDto
{
    public Guid TopicId { get; set; }
    public string TopicCode { get; set; } = string.Empty;
    public string TopicTitle { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; }
    public string RegisteredBy { get; set; } = string.Empty;
    public DateTime? CancelledAt { get; set; }
    public string? CancelledBy { get; set; }
}

// Tình trạng ghi danh của sinh viên trong đợt (màn Chi tiết đề tài, Đơn đăng ký của tôi).
public class MyRegistrationDto
{
    public TopicRoundDto Round { get; set; } = new();
    // Đã công bố và chưa qua ngày kết thúc mốc "Công bố đề tài · SV đăng ký".
    public bool RegistrationOpen { get; set; }
    public GroupDto? Group { get; set; }
    public TopicDto? Topic { get; set; }
    public bool CanCancel { get; set; }
    // Mọi lần ghi danh của nhóm, mới nhất trước.
    public List<RegistrationHistoryDto> History { get; set; } = [];
}

public static class TopicEditScopes
{
    public const string All = "all";
    public const string Content = "content";
    public const string None = "none";
}

public class TopicHistoryDto
{
    public Guid Id { get; set; }
    public DateTime At { get; set; }
    // Họ tên người thực hiện hoặc "Hệ thống".
    public string Actor { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Detail { get; set; }
}

public class TopicDetailDto : TopicDto
{
    // Mới nhất trước; sinh viên không nhận lịch sử.
    public List<TopicHistoryDto> History { get; set; } = [];
    // Phiên bản bài nộp (hiện có Đề cương), cũ trước, cho Giáo vụ/GVHD/thành viên nhóm.
    public List<SubmissionSummaryDto> Submissions { get; set; } = [];
}

public class SubmissionSummaryDto
{
    public Guid Id { get; set; }
    // Đề cương | Giữa kỳ | Cuối kỳ | Bản khóa luận (trùng SUBMISSION_KINDS ở frontend).
    public string Kind { get; set; } = string.Empty;
    public int VersionNo { get; set; }
    public string SubmittedBy { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public bool Late { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public class LecturerLoadDto
{
    public Guid LecturerId { get; set; }
    // Đề tài GV gửi + đề xuất SV đã chấp nhận.
    public int Count { get; set; }
    public int Min { get; set; }
    public int Max { get; set; }
    // below | ok | over; chỉ để cảnh báo, không chặn.
    public string Level { get; set; } = "ok";
}

// Đợt chứa đề tài và tình trạng gửi/công bố của nó.
public class TopicRoundDto
{
    public Guid RoundId { get; set; }
    public string RoundName { get; set; } = string.Empty;
    // Nháp | Đang diễn ra | Đã kết thúc
    public string RoundStatus { get; set; } = string.Empty;
    public DateTime? TopicsPublishedAt { get; set; }
    // yyyy-MM-dd hoặc rỗng (mốc "GV gửi đề tài" và "Công bố đề tài · SV đăng ký").
    public string SubmissionStart { get; set; } = string.Empty;
    public string SubmissionEnd { get; set; } = string.Empty;
    public string RegistrationEnd { get; set; } = string.Empty;
    // GV đang xem có gửi thêm đề tài được không; lý do khi không được.
    public bool CanSubmit { get; set; }
    public string? SubmitBlockedReason { get; set; }
}

public class LecturerTopicsDto
{
    public TopicRoundDto Round { get; set; } = new();
    public List<TopicDto> Items { get; set; } = [];
    public LecturerLoadDto Load { get; set; } = new();
}

public class RoundTopicsDto
{
    public TopicRoundDto Round { get; set; } = new();
    // Theo mã đề tài.
    public List<TopicDto> Items { get; set; } = [];
    // Mỗi GV của đợt một dòng (rỗng với sinh viên).
    public List<LecturerLoadDto> Loads { get; set; } = [];
}
