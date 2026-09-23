namespace KhazObras.Application.Dtos.Financeiro;

public sealed record FinanceiroAnexoResponse(
    Guid Id,
    string NomeArquivo,
    string? ContentType,
    long? TamanhoBytes,
    DateTime UploadedAt);