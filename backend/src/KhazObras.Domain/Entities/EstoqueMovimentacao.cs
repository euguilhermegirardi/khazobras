namespace KhazObras.Domain.Entities;

public sealed class EstoqueMovimentacao
{
    public Guid Id { get; set; }
    public Guid ItemId { get; set; }
    public string Tipo { get; set; } = string.Empty; // "entrada" ou "saida"
    public decimal Quantidade { get; set; }
    public DateOnly Data { get; set; }
    public DateTime CreatedAt { get; set; }
}