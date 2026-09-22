using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using KhazObras.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace KhazObras.Infrastructure.Storage;

public sealed class R2StorageService : IStorageService
{
    private readonly IAmazonS3 _client;
    private readonly string _bucketName;

    public R2StorageService(IConfiguration configuration)
    {
        var accessKey = configuration["R2:AccessKey"]
            ?? throw new InvalidOperationException("R2:AccessKey nao configurado.");
        var secretKey = configuration["R2:SecretKey"]
            ?? throw new InvalidOperationException("R2:SecretKey nao configurado.");
        var endpoint = configuration["R2:Endpoint"]
            ?? throw new InvalidOperationException("R2:Endpoint nao configurado.");
        _bucketName = configuration["R2:BucketName"]
            ?? throw new InvalidOperationException("R2:BucketName nao configurado.");

        var config = new AmazonS3Config
        {
            ServiceURL = endpoint,
            ForcePathStyle = true,
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
        };

        _client = new AmazonS3Client(new BasicAWSCredentials(accessKey, secretKey), config);
    }

    public async Task<string> UploadAsync(string key, Stream content, string contentType)
    {
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            DisablePayloadSigning = true
        };

        await _client.PutObjectAsync(request);
        return key;
    }

    public async Task<Stream> DownloadAsync(string key)
    {
        var response = await _client.GetObjectAsync(_bucketName, key);
        return response.ResponseStream;
    }

    public async Task DeleteAsync(string key)
    {
        await _client.DeleteObjectAsync(_bucketName, key);
    }
}