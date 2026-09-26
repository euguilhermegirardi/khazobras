namespace KhazObras.Domain.Entities;

public sealed class Prestador
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Funcao { get; set; }
    public decimal? ValorContrato { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}