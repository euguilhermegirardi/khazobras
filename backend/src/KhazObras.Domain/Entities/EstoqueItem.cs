namespace KhazObras.Domain.Entities;

public sealed class EstoqueItem
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Unidade { get; set; } = string.Empty;
    public decimal QuantidadeAtual { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}