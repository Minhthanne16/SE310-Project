using Backend.Application.Topics;

namespace Backend.Application.Councils;

// Hợp đồng /api/councils (P06, PDR-063). Ngày dạng yyyy-MM-dd, giờ dạng HH:mm (giờ Việt Nam).

public class CouncilRoundDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    // Mốc 7 "Lịch bảo vệ" để giao diện tô khoảng ngày bảo vệ; chỉ gợi ý, không chặn.
    public string DefenseStart { get; set; } = string.Empty;
    public string DefenseEnd { get; set; } = string.Empty;
}

public class CouncilSlotDto
{
    public Guid Id { get; set; }
    public int Order { get; set; }
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<GroupMemberDto> Group { get; set; } = [];
    public TopicPersonDto Supervisor { get; set; } = new();
    public TopicPersonDto? Reviewer { get; set; }
    public string Start { get; set; } = string.Empty;
    public string End { get; set; } = string.Empty;
    public int ThesisVersionCount { get; set; }
    public bool FinalLocked { get; set; }
    // active | removed | cancelled; danh sách lượt trả về chỉ gồm active, trừ hội đồng đã hủy.
    public string Status { get; set; } = "active";
}

public class CouncilLogDto
{
    public Guid Id { get; set; }
    public DateTime At { get; set; }
    public string Actor { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Detail { get; set; }
}

public class CouncilCorrectionDto
{
    public DateTime At { get; set; }
    public string By { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class CouncilDto
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public string Name { get; set; } = string.Empty;
    // Nháp | Đã công bố | Đã hủy
    public string Status { get; set; } = string.Empty;
    public int Version { get; set; }
    public TopicPersonDto Chair { get; set; } = new();
    public TopicPersonDto Secretary { get; set; } = new();
    public string Date { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
    public DateTime? PublishedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    // Hội đồng đã có phiếu điểm (PDR-018/019/020): khóa sửa giờ/phòng/thành viên và hủy.
    public bool Scored { get; set; }
    public List<CouncilSlotDto> Slots { get; set; } = [];
    // Xung đột hiện tại (trùng phòng, trùng giảng viên, GVHD trong hội đồng, đề tài hết điều kiện); có thì không công bố.
    public List<string> Conflicts { get; set; } = [];
    public List<CouncilCorrectionDto> Corrections { get; set; } = [];
    // Chỉ có ở màn Giáo vụ; mới nhất trước.
    public List<CouncilLogDto> History { get; set; } = [];
    public bool CanEdit { get; set; }
    public string? EditBlockedReason { get; set; }
    public bool CanDelete { get; set; }
    public bool CanPublish { get; set; }
    public string? PublishBlockedReason { get; set; }
    public bool CanCancel { get; set; }
    public bool CanCorrect { get; set; }
}

// Đề tài chưa có lượt bảo vệ có hiệu lực trong đợt.
public class CouncilPoolTopicDto
{
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<GroupMemberDto> Group { get; set; } = [];
    public TopicPersonDto Supervisor { get; set; } = new();
    public TopicPersonDto? Reviewer { get; set; }
    public int ThesisVersionCount { get; set; }
    public bool Eligible { get; set; }
    public string? BlockedReason { get; set; }
}

public class CouncilLecturerDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CouncilStatsDto
{
    public int Councils { get; set; }
    // Đề tài đủ điều kiện hoặc đã có lượt có hiệu lực.
    public int Total { get; set; }
    public int Scheduled { get; set; }
    public int Unscheduled { get; set; }
    public int Conflicts { get; set; }
}

public class CouncilBoardDto
{
    public CouncilRoundDto Round { get; set; } = new();
    public List<CouncilDto> Councils { get; set; } = [];
    public List<CouncilPoolTopicDto> Pool { get; set; } = [];
    public List<CouncilLecturerDto> Lecturers { get; set; } = [];
    public CouncilStatsDto Stats { get; set; } = new();
}

public class CouncilSlotInputDto
{
    public Guid TopicId { get; set; }
    public string? Start { get; set; }
    public string? End { get; set; }
}

public class CouncilInputDto
{
    // Chỉ dùng khi tạo mới và khi kiểm tra trước.
    public Guid RoundId { get; set; }
    public string? Name { get; set; }
    public Guid ChairId { get; set; }
    public Guid SecretaryId { get; set; }
    public string? Date { get; set; }
    public string? Room { get; set; }
    // Theo thứ tự bảo vệ.
    public List<CouncilSlotInputDto>? Slots { get; set; }
    // Khi sửa: Version đang thấy; lệch thì 409.
    public int? ExpectedVersion { get; set; }
    // Bắt buộc khi sửa hội đồng đã công bố (PDR-018).
    public string? Reason { get; set; }
}

public class CouncilCheckInputDto : CouncilInputDto
{
    // Hội đồng đang sửa; null khi kiểm tra một hội đồng mới.
    public Guid? CouncilId { get; set; }
}

public class CouncilCheckResultDto
{
    public bool Ok { get; set; }
    public List<string> Problems { get; set; } = [];
}

public class CouncilPublishInputDto
{
    public Guid RoundId { get; set; }
    // null hoặc rỗng: mọi hội đồng Nháp của đợt.
    public List<Guid>? CouncilIds { get; set; }
}

public class CouncilPublishItemDto
{
    public Guid CouncilId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Ok { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class CouncilPublishResultDto
{
    public int Published { get; set; }
    public int Skipped { get; set; }
    public List<CouncilPublishItemDto> Results { get; set; } = [];
}

public class CouncilReasonInputDto
{
    public string? Reason { get; set; }
}

public class CouncilCorrectionInputDto
{
    public string? Content { get; set; }
    public string? Reason { get; set; }
}

// Màn Hội đồng của giảng viên: chỉ hội đồng đã công bố hoặc đã hủy mà mình là Chủ tịch/Thư ký.
public class MyCouncilDto
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    // chair | secretary
    public string MyRole { get; set; } = string.Empty;
    public TopicPersonDto Chair { get; set; } = new();
    public TopicPersonDto Secretary { get; set; } = new();
    public string Date { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
    public string? CancelReason { get; set; }
    public List<CouncilSlotDto> Slots { get; set; } = [];
    public List<CouncilCorrectionDto> Corrections { get; set; } = [];
}

public class MyCouncilsDto
{
    public List<CouncilRoundDto> Rounds { get; set; } = [];
    public Guid? RoundId { get; set; }
    public List<MyCouncilDto> Councils { get; set; } = [];
}

// Lịch bảo vệ hiển thị trong chi tiết đề tài (aside Không gian đề tài, Chi tiết đề tài của Giáo vụ).
public class TopicDefenseDto
{
    public Guid CouncilId { get; set; }
    public string Council { get; set; } = string.Empty;
    public bool CouncilPublished { get; set; }
    public string Chair { get; set; } = string.Empty;
    public string Secretary { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    // yyyy-MM-ddTHH:mm:ss (giờ Việt Nam), như TopicDefense phía frontend.
    public string Start { get; set; } = string.Empty;
    public string End { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
    public int Order { get; set; }
    public List<CouncilCorrectionDto> Corrections { get; set; } = [];
}
