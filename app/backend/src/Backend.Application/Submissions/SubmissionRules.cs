using System.Globalization;
using System.Text;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;

namespace Backend.Application.Submissions;

// PDR-039/040: bản nộp học thuật chỉ là PDF, tối đa 20 MB mỗi tệp; xét nội dung tệp,
// không tin phần mở rộng hay Content-Type do trình duyệt khai báo.
public static class SubmissionPolicy
{
    public const long MaxBytes = 20 * 1024 * 1024;
    public const int MaxNoteLength = 500;
    public const int MaxFileNameLength = 200;
    public const string ContentType = "application/pdf";

    public const string MissingFileMessage = "Chọn tệp PDF để nộp (trường 'file').";
    public const string TooLargeMessage = "Tệp vượt quá 20 MB. Giảm dung lượng tệp PDF rồi nộp lại.";
    public const string NotPdfMessage = "Tệp không phải PDF hợp lệ. Chỉ nhận tệp PDF.";
    public const string NoteRequiredMessage = "Nhập ghi chú thay đổi cho bản báo cáo cuối kỳ.";
    public static readonly string NoteTooLongMessage = $"Ghi chú thay đổi tối đa {MaxNoteLength} ký tự.";
    public const string InvalidKindMessage = "Loại báo cáo phải là midterm hoặc final.";

    // Đặc tả PDF cho phép phần đầu tệp lệch vài byte và phần kết nằm trong 1024 byte cuối.
    private const int HeaderWindow = 1024;
    private const int TrailerWindow = 1024;

    // Tệp PDF thật có chữ ký "%PDF-" ở đầu và dấu kết "%%EOF" ở cuối. Tệp đổi đuôi (docx, ảnh, exe)
    // không qua được cả hai; không giải mã nội dung PDF vì cần thêm thư viện (PDR-056).
    public static bool IsPdf(ReadOnlySpan<byte> content)
    {
        if (content.Length < 16) return false;
        var head = content[..Math.Min(HeaderWindow, content.Length)];
        var tail = content[Math.Max(0, content.Length - TrailerWindow)..];
        return head.IndexOf("%PDF-"u8) >= 0 && tail.LastIndexOf("%%EOF"u8) >= 0;
    }

    // Khóa ngẫu nhiên, không chứa tên tệp hay dữ liệu người dùng.
    public static string NewObjectKey(Guid topicId, SubmissionKind kind) =>
        $"submissions/{topicId:N}/{SubmissionRules.KindName(kind)}/{Guid.NewGuid():N}.pdf";

    // Chỉ giữ tên tệp (bỏ đường dẫn), bỏ ký tự điều khiển và ký tự phá header; luôn kết thúc bằng .pdf.
    public static string CleanFileName(string? raw)
    {
        var name = (raw ?? string.Empty).Replace('\\', '/');
        name = name[(name.LastIndexOf('/') + 1)..];
        var builder = new StringBuilder(name.Length);
        foreach (var c in name.Normalize(NormalizationForm.FormC))
            if (!char.IsControl(c) && c is not ('"' or '<' or '>' or ':' or '|' or '?' or '*' or ';'))
                builder.Append(c);
        name = builder.ToString().Trim().Trim('.').Trim();
        if (name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) name = name[..^4].TrimEnd().TrimEnd('.');
        if (name.Length == 0) name = "bao-cao";
        if (name.Length > MaxFileNameLength - 4) name = name[..(MaxFileNameLength - 4)];
        return name + ".pdf";
    }
}

public enum SubmissionWindow { OnTime, Late, Closed }

// Nối cấu hình mốc của đợt với việc nhận/từ chối nộp (PDR-041). Hạn tính đến 23:59 giờ Việt Nam
// của ngày kết thúc, cùng quy ước với các mốc khác của đợt.
public static class SubmissionRules
{
    public const string NotFoundMessage = "Không tìm thấy đề tài.";
    public const string SubmissionNotFoundMessage = "Không tìm thấy bài nộp.";
    public const string FileMissingMessage = "Tệp của bài nộp không còn trong kho lưu trữ. Báo Giáo vụ để kiểm tra.";
    public const string OnlyMembersMessage = "Chỉ thành viên nhóm thực hiện đề tài được nộp báo cáo.";
    public const string RoundNotRunningMessage = "Đợt không còn diễn ra nên không nộp được báo cáo.";
    public const string NotInProgressMessage = "Chỉ nộp báo cáo khi đề tài đang thực hiện (sau khi hết thời gian đăng ký).";
    public const string OutlineNotApprovedMessage = "Chỉ nộp báo cáo sau khi GVHD duyệt đề cương.";
    public const string TopicClosedMessage = "Đề tài đã kết thúc nên không nộp được báo cáo.";

    public static readonly IReadOnlyList<SubmissionKind> Kinds = [SubmissionKind.Midterm, SubmissionKind.Final];

    public static string KindName(SubmissionKind kind) => kind == SubmissionKind.Midterm ? "midterm" : "final";
    public static string KindLabel(SubmissionKind kind) => kind == SubmissionKind.Midterm ? "Báo cáo giữa kỳ" : "Báo cáo cuối kỳ";
    public static MilestoneKey MilestoneOf(SubmissionKind kind) => kind == SubmissionKind.Midterm ? MilestoneKey.Midterm : MilestoneKey.Final;
    // Mỗi bản báo cáo cuối kỳ kèm ghi chú thay đổi bắt buộc (DESIGN · Không gian đề tài).
    public static bool NoteRequired(SubmissionKind kind) => kind == SubmissionKind.Final;

    public static bool TryParseKind(string? value, out SubmissionKind kind)
    {
        kind = value == "final" ? SubmissionKind.Final : SubmissionKind.Midterm;
        return value is "midterm" or "final";
    }

    // Hạn trễ chỉ có hiệu lực khi công tắc bật và hạn nằm sau hạn thường.
    public static DateOnly? LateDeadline(RoundMilestone? milestone) =>
        milestone is { AllowLate: true, EndDate: { } end, LateEndDate: { } late } && late > end ? late : null;

    public static SubmissionWindow Window(RoundMilestone? milestone, DateOnly today)
    {
        if (milestone?.EndDate is not { } end || today <= end) return SubmissionWindow.OnTime;
        return LateDeadline(milestone) is { } late && today <= late ? SubmissionWindow.Late : SubmissionWindow.Closed;
    }

    public static string ClosedMessage(SubmissionKind kind, RoundMilestone? milestone)
    {
        var label = KindLabel(kind).ToLowerInvariant();
        return LateDeadline(milestone) is { } late
            ? $"Đã hết hạn nộp trễ {label} (hết ngày {Format(late)})."
            : $"Đã hết hạn nộp {label} (hết ngày {Format(milestone?.EndDate)}); mốc này không cho nộp trễ.";
    }

    // Lý do nhóm không nộp được loại báo cáo này; null = nộp được.
    public static string? Blocker(ThesisTopic topic, ThesisRound round, SubmissionKind kind, DateOnly today)
    {
        if (round.Status != RoundStatus.Running) return RoundNotRunningMessage;
        var status = TopicRules.Effective(topic, round, today);
        if (status is TopicStatus.Completed or TopicStatus.Ineligible) return TopicClosedMessage;
        if (status is not (TopicStatus.InProgress or TopicStatus.Grading or TopicStatus.Graded or TopicStatus.Deviation or TopicStatus.Confirmed))
            return NotInProgressMessage;
        // BUSINESS_RULES: duyệt đề cương là điều kiện mở báo cáo giữa kỳ/cuối kỳ.
        if (topic.OutlineApprovedAt is null) return OutlineNotApprovedMessage;
        var milestone = round.Milestones.FirstOrDefault(m => m.Key == MilestoneOf(kind));
        return Window(milestone, today) == SubmissionWindow.Closed ? ClosedMessage(kind, milestone) : null;
    }

    private static string Format(DateOnly? date) => date?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) ?? "chưa đặt";
}
