namespace KhazObras.Domain.Entities;

public sealed class Foto
{
    public Guid Id { get; set; }
    public Guid RelatorioFotograficoId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public DateOnly? DataFoto { get; set; }
    public string? Descricao { get; set; }
    public int Ordem { get; set; }
    public DateTime CreatedAt { get; set; }
}