namespace KhazObras.Domain.Entities;

/// <summary>Contrato da obra (tabela contratos). <c>StorageKey</c> existe no schema mas nao e usado no V1 (sem upload).</summary>
public sealed class Contrato
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public string Numero { get; set; } = string.Empty;
    public decimal ValorContratado { get; set; }
    public DateOnly? DataAssinatura { get; set; }
    public string? StorageKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Soma dos pagamentos, calculada no SQL (SUM). Preenchida so nas consultas de leitura.</summary>
    public decimal TotalPago { get; set; }
}
