namespace KhazObras.Domain.Entities;

public sealed class FinanceiroLancamentoAnexo
{
    public Guid Id { get; set; }
    public Guid LancamentoId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long? TamanhoBytes { get; set; }
    public DateTime UploadedAt { get; set; }
}