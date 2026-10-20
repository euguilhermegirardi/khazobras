using KhazObras.Domain.Enums;

namespace KhazObras.Domain.Entities;

/// <summary>Linha enxuta da medicao para a lista do admin (sem itens; com nome da etapa e contagem de itens).</summary>
public sealed class MedicaoResumo
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public Guid? EtapaId { get; set; }
    public string? EtapaNome { get; set; }
    public int Numero { get; set; }
    public DateOnly Competencia { get; set; }
    public decimal ValorTotal { get; set; }
    public MedicaoStatus Status { get; set; }
    public int QuantidadeItens { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? NfIssuedAt { get; set; }
    public string? NfNumber { get; set; }
}
