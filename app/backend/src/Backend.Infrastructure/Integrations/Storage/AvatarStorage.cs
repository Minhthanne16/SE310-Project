using Backend.Application.Common.Storage;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace Backend.Infrastructure.Integrations.Storage;

public sealed class MinioAvatarStorage(IMinioClient client, StorageOptions options) : IAvatarStorage
{
    public Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default) =>
        GuardAsync(async () =>
        {
            var exists = await client.BucketExistsAsync(new BucketExistsArgs().WithBucket(options.Bucket), cancellationToken);
            if (!exists) await client.MakeBucketAsync(new MakeBucketArgs().WithBucket(options.Bucket), cancellationToken);

            using var stream = new MemoryStream(content, writable: false);
            await client.PutObjectAsync(new PutObjectArgs()
                .WithBucket(options.Bucket)
                .WithObject(objectKey)
                .WithStreamData(stream)
                .WithObjectSize(content.Length)
                .WithContentType(contentType), cancellationToken);
        });

    public async Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        byte[]? content = null;
        await GuardAsync(async () =>
        {
            try
            {
                using var buffer = new MemoryStream();
                await client.GetObjectAsync(new GetObjectArgs()
                    .WithBucket(options.Bucket)
                    .WithObject(objectKey)
                    .WithCallbackStream(stream => stream.CopyTo(buffer)), cancellationToken);
                content = buffer.ToArray();
            }
            catch (Exception ex) when (ex is ObjectNotFoundException or BucketNotFoundException)
            {
                content = null;
            }
        });
        return content;
    }

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default) =>
        GuardAsync(() => client.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(options.Bucket).WithObject(objectKey), cancellationToken));

    private static async Task GuardAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new StorageUnavailableException("Object storage request failed.", ex);
        }
    }
}

// Môi trường chưa cấu hình Storage: hồ sơ vẫn hoạt động, chỉ thao tác ảnh báo lỗi rõ.
public sealed class UnavailableAvatarStorage : IAvatarStorage
{
    public Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default) => throw Unavailable();
    public Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default) => throw Unavailable();
    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default) => throw Unavailable();

    private static StorageUnavailableException Unavailable() => new("Object storage is not configured.");
}
