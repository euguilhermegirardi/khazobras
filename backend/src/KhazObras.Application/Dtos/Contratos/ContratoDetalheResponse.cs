namespace KhazObras.Application.Dtos.Contratos;

/// <summary>Visao Admin/Master: contrato + pagamentos (data do pagamento mais recente primeiro).</summary>
public sealed record ContratoDetalheResponse(
    Guid Id,
    Guid ObraId,
    string Numero,
    decimal ValorContratado,
    DateOnly? DataAssinatura,
    decimal TotalPago,
    decimal SaldoAPagar,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<PagamentoResponse> Pagamentos);
