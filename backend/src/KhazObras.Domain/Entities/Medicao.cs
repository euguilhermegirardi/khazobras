using KhazObras.Domain.Enums;

namespace KhazObras.Domain.Entities;

public sealed class Medicao
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public Guid? EtapaId { get; set; }
    public int Numero { get; set; }
    public DateOnly Competencia { get; set; }
    public decimal ValorTotal { get; set; }
    public MedicaoStatus Status { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public string? NfNumber { get; set; }
    public DateTime? NfIssuedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<MedicaoItem> Itens { get; set; } = [];
}