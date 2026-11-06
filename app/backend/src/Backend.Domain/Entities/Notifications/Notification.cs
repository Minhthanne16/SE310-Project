using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Một dòng cho mỗi người nhận; các dòng của cùng một lần gửi có chung BatchId.
// Trạng thái đọc nằm trên từng dòng nên riêng theo từng người nhận (DOMAIN_MODEL).
public class Notification : BaseEntity
{
    public Guid BatchId { get; set; }
    public Guid RecipientUserId { get; set; }
    // Null nghĩa là thông báo tự động của hệ thống.
    public Guid? SenderUserId { get; set; }
    public User? Sender { get; set; }
    public string Kind { get; set; } = NotificationKinds.Post;
    public string Text { get; set; } = string.Empty;
    // Đường dẫn nội bộ mở khi bấm vào thông báo.
    public string Href { get; set; } = "/";
    public DateTime? ReadAt { get; set; }
}

// Quyết định biểu tượng trên chuông (artboard ThongBaoMenu).
public static class NotificationKinds
{
    public const string Assign = "assign";
    public const string Success = "success";
    public const string Reject = "reject";
    public const string Schedule = "schedule";
    public const string Comment = "comment";
    public const string Deadline = "deadline";
    public const string Result = "result";
    public const string Inbox = "inbox";
    public const string Post = "post";
}
