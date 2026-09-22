using KhazObras.Domain.Enums;

namespace KhazObras.Domain.Entities;

public sealed class MedicaoItem
{
    public Guid Id { get; set; }
    public Guid MedicaoId { get; set; }
    public ItemTipo Tipo { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Quantidade { get; set; }
    public decimal ValorUnitario { get; set; }
    public decimal ValorTotal { get; set; }
}