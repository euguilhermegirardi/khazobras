namespace KhazObras.Domain.Entities;

public sealed class ProjetoDocumento
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public Guid? EtapaId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string? TipoDocumento { get; set; }
    public DateTime UploadedAt { get; set; }
}