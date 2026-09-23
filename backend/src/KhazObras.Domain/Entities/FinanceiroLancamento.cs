using KhazObras.Domain.Enums;

namespace KhazObras.Domain.Entities;

public sealed class FinanceiroLancamento
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public ItemTipo Categoria { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateOnly DataLancamento { get; set; }
    public DateOnly MesCompetencia { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<FinanceiroLancamentoAnexo> Anexos { get; set; } = [];
}