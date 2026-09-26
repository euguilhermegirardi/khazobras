namespace KhazObras.Domain.Entities;

public sealed class Pipeline
{
    public Guid Id { get; set; }
    public string NomeClientePotencial { get; set; } = string.Empty;
    public decimal? ValorEstimado { get; set; }
    public decimal? Probabilidade { get; set; }
    public string EtapaFunil { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}