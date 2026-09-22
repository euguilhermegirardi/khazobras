namespace KhazObras.Application.Abstractions;

public interface IStorageService
{
    Task<string> UploadAsync(string key, Stream content, string contentType);
    Task<Stream> DownloadAsync(string key);
    Task DeleteAsync(string key);
}