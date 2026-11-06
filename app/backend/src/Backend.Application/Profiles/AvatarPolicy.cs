namespace Backend.Application.Profiles;

public sealed record AvatarFormat(string Extension, string ContentType);

// PDR-043: JPG, PNG hoặc WebP, tối đa 2 MB; xét nội dung tệp, không tin phần mở rộng
// hay Content-Type do trình duyệt khai báo.
public static class AvatarPolicy
{
    public const long MaxBytes = 2 * 1024 * 1024;
    public const string TooLargeMessage = "Ảnh vượt quá 2 MB. Chọn ảnh nhỏ hơn hoặc giảm kích thước ảnh rồi thử lại.";
    public const string InvalidFormatMessage = "Ảnh không đúng định dạng. Chỉ nhận JPG, PNG hoặc WebP.";

    private static readonly AvatarFormat Jpeg = new("jpg", "image/jpeg");
    private static readonly AvatarFormat Png = new("png", "image/png");
    private static readonly AvatarFormat Webp = new("webp", "image/webp");

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static ReadOnlySpan<byte> JpegSignature => [0xFF, 0xD8, 0xFF];

    public static AvatarFormat? Detect(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(PngSignature)) return Png;
        if (content.StartsWith(JpegSignature)) return Jpeg;
        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content[8..12].SequenceEqual("WEBP"u8)) return Webp;
        return null;
    }

    // Khóa ngẫu nhiên, không đoán được; phần đuôi cho biết định dạng đã kiểm tra.
    public static string NewObjectKey(Guid userId, AvatarFormat format) =>
        $"avatars/{userId:N}/{Guid.NewGuid():N}.{format.Extension}";

    public static string ContentTypeOf(string objectKey) => Path.GetExtension(objectKey) switch
    {
        ".png" => Png.ContentType,
        ".webp" => Webp.ContentType,
        _ => Jpeg.ContentType
    };

    // Phần ngẫu nhiên của khóa làm tham số phiên bản để trình duyệt không dùng lại ảnh cũ.
    public static string? UrlFor(string? objectKey) =>
        objectKey is null ? null : $"/api/profile/avatar?v={Path.GetFileNameWithoutExtension(objectKey)}";
}
