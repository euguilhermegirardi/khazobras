namespace KhazObras.Domain.Entities;

/// <summary>Pagamento recebido do cliente, dentro de um contrato (tabela pagamentos).</summary>
public sealed class Pagamento
{
    public Guid Id { get; set; }
    public Guid ContratoId { get; set; }
    public Guid? ReferenteMedicaoId { get; set; }

    /// <summary>Numero da medicao referenciada (JOIN preso a mesma obra). Preenchido so nas consultas de leitura.</summary>
    public int? ReferenteMedicaoNumero { get; set; }

    public decimal Valor { get; set; }
    public DateOnly DataPagamento { get; set; }
    public string? FormaPagamento { get; set; }
    public DateTime CreatedAt { get; set; }
}
