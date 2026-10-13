using KhazObras.Application.Abstractions;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeStorageService : IStorageService
{
    public Task<string> UploadAsync(string key, Stream content, string contentType) => Task.FromResult(key);

    public Task<Stream> DownloadAsync(string key) => Task.FromResult<Stream>(new MemoryStream());

    public Task DeleteAsync(string key) => Task.CompletedTask;
}
