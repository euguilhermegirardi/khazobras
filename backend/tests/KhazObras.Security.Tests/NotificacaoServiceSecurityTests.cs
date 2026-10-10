using KhazObras.Api.Validation;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Services;
using KhazObras.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace KhazObras.Security.Tests;

public sealed class NotificacaoServiceSecurityTests
{
    [Fact]
    public async Task MarkAsReadAsync_ShouldRejectNotificationsOwnedByAnotherUser()
    {
        var repository = new FakeNotificacaoRepository(new Notificacao
        {
            Id = Guid.NewGuid(),
            ObraId = Guid.NewGuid(),
            UserId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Modulos = ["financeiro"],
            Canal = "email",
            EnviadoAt = DateTime.UtcNow
        });

        var service = new NotificacaoService(repository);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.MarkAsReadAsync(repository.Notification.Id, Guid.Parse("22222222-2222-2222-2222-222222222222")));
    }

    [Fact]
    public void FileUploadValidator_ShouldRejectMimeAndMagicMismatch()
    {
        using var pngPayload = new MemoryStream(new byte[]
        {
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        });

        var formFile = new FormFile(pngPayload, 0, pngPayload.Length, "file", "malware.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png"
        };

        var isValid = FileUploadValidator.IsValid(formFile, out var error);

        Assert.False(isValid);
        Assert.NotNull(error);
        Assert.Contains("incompatíveis", error!);
    }

        private static FormFile CreateFile(byte[] content, string fileName, string contentType)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, stream.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    [Fact]
    public void FileUploadValidator_ShouldRejectTextDisguisedAsPdf()
    {
        var file = CreateFile("isso nao e um pdf"u8.ToArray(), "falso.pdf", "application/pdf");

        var isValid = FileUploadValidator.IsValid(file, out var error);

        Assert.False(isValid);
        Assert.Equal("Conteudo do arquivo nao corresponde ao tipo informado.", error);
    }

    [Fact]
    public void FileUploadValidator_ShouldAcceptValidPng()
    {
        var png = new byte[]
        {
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        };
        var file = CreateFile(png, "foto.png", "image/png");

        var isValid = FileUploadValidator.IsValid(file, out var error);

        Assert.True(isValid);
        Assert.Null(error);
    }

    [Fact]
    public void FileUploadValidator_ShouldRejectFakeXlsx()
    {
        var file = CreateFile(
            "nao sou um zip"u8.ToArray(),
            "planilha.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        var isValid = FileUploadValidator.IsValid(file, out _);

        Assert.False(isValid);
    }

    private sealed class FakeNotificacaoRepository : INotificacaoRepository
    {
        public Notificacao Notification { get; }

        public FakeNotificacaoRepository(Notificacao notification)
        {
            Notification = notification;
        }

        public Task<Notificacao> CreateAsync(Notificacao notificacao) => Task.FromResult(notificacao);

        public Task<IReadOnlyList<Notificacao>> GetByUserIdAsync(Guid userId) =>
            Task.FromResult<IReadOnlyList<Notificacao>>(new List<Notificacao> { Notification });

        public Task MarkAsReadAsync(Guid id, Guid userId, DateTime lidaAt) => Task.CompletedTask;

        public Task<Notificacao?> GetByIdAsync(Guid id) => Task.FromResult<Notificacao?>(Notification);
    }
}
