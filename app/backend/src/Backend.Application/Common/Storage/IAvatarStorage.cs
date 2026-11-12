namespace Backend.Application.Common.Storage;

// Ảnh đại diện nằm trong object storage riêng tư; frontend chỉ đọc qua API có kiểm tra quyền.
public interface IAvatarStorage
{
    Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default);
    // Null khi object không còn trong storage.
    Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default);
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);
}

// Tệp bài nộp (PDF) dùng cùng object storage riêng tư; chỉ backend giữ thông tin kết nối và khóa object.
public interface IDocumentStorage
{
    Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default);
    // Null khi object không còn trong storage.
    Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default);
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);
}

public sealed class StorageUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
