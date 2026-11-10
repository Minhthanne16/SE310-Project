using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Nhóm 1–2 sinh viên trong một đợt, đúng một đại diện (BUSINESS_RULES). Nhóm được giữ nguyên
// thành viên và đại diện sau khi hủy ghi danh (PDR-047), nên tách khỏi lần ghi danh.
public class ThesisGroup : BaseEntity
{
    public const int MaxMembers = 2;

    public Guid RoundId { get; set; }
    public Guid RepresentativeId { get; set; }
    public List<GroupMember> Members { get; set; } = [];
}

// RoundId lặp lại ở đây để chỉ mục duy nhất (RoundId, StudentId) chặn một sinh viên thuộc hai nhóm
// trong cùng đợt, kể cả khi hai nhóm được tạo đồng thời.
public class GroupMember : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid RoundId { get; set; }
    public Guid StudentId { get; set; }
    public User? Student { get; set; }
}

// Một lần nhóm ghi danh đề tài công bố. Hủy thì ghi người/thời điểm, không xóa (PDR-047).
public class TopicRegistration : BaseEntity
{
    public Guid TopicId { get; set; }
    public Guid GroupId { get; set; }
    public Guid RegisteredById { get; set; }
    public Guid? CancelledById { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public enum RegisterOutcome
{
    Registered,
    // Nhóm khác vừa nhận đề tài (thua tranh chấp).
    TopicTaken,
    // Sinh viên vừa vào nhóm khác trong đợt.
    MemberTaken,
    // Nhóm vừa ghi danh đề tài khác.
    GroupHasTopic
}

public enum ProposalCreateOutcome
{
    Created,
    MemberTaken,
    GroupHasTopic
}
