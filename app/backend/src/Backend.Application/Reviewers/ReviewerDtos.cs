using Backend.Application.Topics;

namespace Backend.Application.Reviewers;

public class ReviewerRoundDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    // Mức tối đa đề tài mỗi GV của đợt; 0 = chưa đặt (chỉ cảnh báo, PDR-062).
    public int LoadMax { get; set; }
}

// Một đề tài trên màn phân công của Giáo vụ.
public class ReviewerTopicRowDto
{
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public TopicPersonDto Supervisor { get; set; } = new();
    public List<GroupMemberDto> Group { get; set; } = [];
    public DateTime? OutlineApprovedAt { get; set; }
    public TopicPersonDto? Reviewer { get; set; }
    public DateTime? AssignedAt { get; set; }
    // Đủ điều kiện phân công (đề cương đã duyệt, đề tài còn hiệu lực, đợt đang diễn ra) và lý do khi chưa.
    public bool Eligible { get; set; }
    public string? BlockedReason { get; set; }
    // PDR-023: GVPB đã nhập phiếu đầu tiên nên không đổi được.
    public bool Locked { get; set; }
    public string? LockReason { get; set; }
    public bool HasMidterm { get; set; }
    public bool HasFinal { get; set; }
}

public class ReviewerLecturerDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Department { get; set; }
    public int ReviewCount { get; set; }
    public int SuperviseCount { get; set; }
    public int Max { get; set; }
    // ok | over (chỉ khi Max > 0); chỉ cảnh báo, không chặn.
    public string Level { get; set; } = "ok";
}

public class ReviewerAssignmentsDto
{
    public ReviewerRoundDto Round { get; set; } = new();
    public List<ReviewerTopicRowDto> Topics { get; set; } = [];
    public List<ReviewerLecturerDto> Lecturers { get; set; } = [];
}

// Gợi ý chỉ để điền sẵn bản nháp; không ghi dữ liệu (PDR-062).
public class ReviewerSuggestionDto
{
    public Guid TopicId { get; set; }
    public Guid? LecturerId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class AssignReviewerInputDto
{
    public Guid ReviewerId { get; set; }
    // GVPB Giáo vụ đang thấy; null nếu đề tài chưa có. Lệch với hiện tại thì 409.
    public Guid? ExpectedReviewerId { get; set; }
}

public class AssignReviewerResultDto
{
    public ReviewerTopicRowDto Row { get; set; } = new();
    public string? Warning { get; set; }
}

public class ReviewerBatchItemDto
{
    public Guid TopicId { get; set; }
    public Guid ReviewerId { get; set; }
    public Guid? ExpectedReviewerId { get; set; }
}

public class ReviewerBatchInputDto
{
    public Guid RoundId { get; set; }
    public List<ReviewerBatchItemDto>? Items { get; set; }
}

public class ReviewerBatchResultItemDto
{
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public bool Ok { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Warning { get; set; }
    public ReviewerTopicRowDto? Row { get; set; }
}

public class ReviewerBatchResultDto
{
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public List<ReviewerBatchResultItemDto> Results { get; set; } = [];
}

public class MyReviewItemDto
{
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<GroupMemberDto> Group { get; set; } = [];
    public TopicPersonDto Supervisor { get; set; } = new();
    public DateTime? AssignedAt { get; set; }
    public bool HasFinal { get; set; }
    // PDR-022: được phân công và nhóm đã nộp báo cáo cuối kỳ. Việc chặn lưu phiếu thật thuộc P07.
    public bool CanScore { get; set; }
    public string? ScoreBlockedReason { get; set; }
    // Chưa có phiếu phản biện (P07 sẽ cập nhật).
    public bool Scored { get; set; }
}

public class MyReviewDto
{
    // Các đợt mà giảng viên có đề tài phản biện, mới nhất trước.
    public List<ReviewerRoundDto> Rounds { get; set; } = [];
    public Guid? RoundId { get; set; }
    public List<MyReviewItemDto> Items { get; set; } = [];
}
