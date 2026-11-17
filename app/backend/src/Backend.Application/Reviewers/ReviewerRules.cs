using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;

namespace Backend.Application.Reviewers;

// Quy tắc phân công Giảng viên phản biện (PDR-021/022/023, PDR-062). Hàm thuần, không truy cập dữ liệu.
public static class ReviewerRules
{
    public const string RoundNotRunningMessage = "Đợt không còn diễn ra nên không phân công phản biện.";
    public const string NoGroupMessage = "Đề tài không có nhóm";
    public const string EndedMessage = "Đề tài đã kết thúc";
    public const string OutlineNotApprovedMessage = "Chưa duyệt đề cương";
    public const string SupervisorMessage = "GVHD không phản biện đề tài mình hướng dẫn";
    public const string NotRoundLecturerMessage = "Giảng viên không thuộc danh sách giảng viên của đợt";
    public const string InactiveLecturerMessage = "Tài khoản giảng viên đang bị vô hiệu hóa";
    public const string ChangedMessage = "Phân công vừa thay đổi, tải lại";
    public const string LockedMessage = "GVPB đã nhập phiếu điểm; không đổi được (PDR-023)";
    public const string DuplicateInBatchMessage = "Trùng đề tài trong lô";
    public const string TopicNotInRoundMessage = "Đề tài không thuộc đợt đã chọn";
    public const string NoFinalMessage = "Nhóm chưa nộp báo cáo cuối kỳ";
    public const string NotReviewerMessage = "Bạn không được phân công phản biện đề tài này";
    public const int MaxBatchSize = 200;

    // Đề tài hiện trong danh sách phân công: loại đề xuất SV chưa được nhận hoặc đã bị từ chối/hủy.
    public static bool Listed(ThesisTopic topic) => TopicRules.CountsTowardLoad(topic);

    // Lý do đề tài chưa thể phân công; null = đủ điều kiện. Không xét báo cáo giữa kỳ/cuối kỳ (PDR-021).
    public static string? AssignBlocker(ThesisTopic topic, ThesisRound round, DateOnly today)
    {
        if (round.Status != RoundStatus.Running) return RoundNotRunningMessage;
        var status = TopicRules.Effective(topic, round, today);
        if (status is TopicStatus.Completed or TopicStatus.Ineligible) return EndedMessage;
        if (topic.GroupId is null || status is TopicStatus.NotRegistered or TopicStatus.NoGroup or TopicStatus.PendingApproval
            or TopicStatus.Rejected or TopicStatus.Cancelled) return NoGroupMessage;
        if (topic.OutlineApprovedAt is null) return OutlineNotApprovedMessage;
        return null;
    }

    // Lý do đang khóa đổi GVPB (PDR-023); null = đổi được.
    public static string? LockReason(ThesisTopic topic) => topic.ReviewerFirstScoredAt is null ? null : LockedMessage;

    // Lý do một giảng viên không được chọn làm GVPB của đề tài; null = hợp lệ.
    public static string? CandidateBlocker(ThesisTopic topic, ThesisRound round, User? lecturer)
    {
        if (lecturer is null || lecturer.Role != UserRole.Lecturer || !TopicMapping.IsLecturerOf(round, lecturer.Id))
            return NotRoundLecturerMessage;
        if (!lecturer.IsActive) return InactiveLecturerMessage;
        if (lecturer.Id == topic.SupervisorId) return SupervisorMessage;
        return null;
    }

    // PDR-022: GVPB hiện tại và nhóm đã nộp báo cáo cuối kỳ; không xét giữa kỳ hay bản chốt.
    public static string? ScoreBlocker(ThesisTopic topic, Guid viewerId, bool hasFinal)
    {
        if (topic.ReviewerId != viewerId) return NotReviewerMessage;
        return hasFinal ? null : NoFinalMessage;
    }

    public sealed record SuggestLecturer(Guid Id, string Code, bool Active, int SuperviseCount);

    // Gợi ý (PDR-062 mục 3): đề tài theo mã tăng dần; mỗi lượt gợi ý tính vào số phản biện của GV.
    public static List<ReviewerSuggestionDto> Suggest(IEnumerable<ThesisTopic> candidates, IReadOnlyCollection<SuggestLecturer> lecturers,
        IReadOnlyCollection<ThesisTopic> roundTopics, int loadMax)
    {
        var review = lecturers.ToDictionary(l => l.Id, l => roundTopics.Count(t => t.ReviewerId == l.Id));
        var fields = lecturers.ToDictionary(l => l.Id, l => roundTopics
            .Where(t => t.SupervisorId == l.Id && TopicRules.CountsTowardLoad(t)).Select(t => NormalizeField(t.Field)).ToHashSet());
        var result = new List<ReviewerSuggestionDto>();
        foreach (var topic in candidates.OrderBy(t => t.Number))
        {
            var field = NormalizeField(topic.Field);
            var best = lecturers
                .Where(l => l.Active && l.Id != topic.SupervisorId && (loadMax <= 0 || review[l.Id] < loadMax))
                .Select(l => (Lecturer: l, Same: fields[l.Id].Contains(field), Count: review[l.Id]))
                .OrderByDescending(x => x.Same).ThenBy(x => x.Count).ThenBy(x => x.Lecturer.SuperviseCount)
                .ThenBy(x => x.Lecturer.Code, StringComparer.Ordinal)
                .Cast<(SuggestLecturer Lecturer, bool Same, int Count)?>().FirstOrDefault();
            if (best is not { } pick)
            {
                result.Add(new ReviewerSuggestionDto { TopicId = topic.Id, LecturerId = null, Reason = "Không có giảng viên phù hợp: ai cũng đã đạt mức tối đa hoặc là GVHD của đề tài." });
                continue;
            }
            review[pick.Lecturer.Id]++;
            result.Add(new ReviewerSuggestionDto
            {
                TopicId = topic.Id,
                LecturerId = pick.Lecturer.Id,
                Reason = pick.Same
                    ? $"Cùng lĩnh vực {topic.Field}; đang phản biện {pick.Count} đề tài."
                    : $"Ít đề tài phản biện nhất ({pick.Count})."
            });
        }
        return result;
    }

    private static string NormalizeField(string field) => (field ?? string.Empty).Trim().ToLowerInvariant();
}
