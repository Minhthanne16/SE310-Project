namespace Backend.Application.Common.Storage;

// Tệp PDF bài nộp (PDR-039/042) nằm trong object storage riêng tư; chỉ đọc qua API có kiểm tra quyền.
// Không có thao tác xóa trong luồng nghiệp vụ: mọi phiên bản được giữ.
public interface IDocumentStorage
{
    Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default);
    // Null khi object không còn trong storage.
    Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default);
    // Chỉ dùng để dọn object vừa ghi khi lưu DB thất bại.
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);
}
