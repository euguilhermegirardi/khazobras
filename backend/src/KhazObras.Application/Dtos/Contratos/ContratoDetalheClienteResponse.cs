namespace KhazObras.Application.Dtos.Contratos;

/// <summary>Visao do CLIENTE: contrato reduzido + os pagamentos que ele fez (data mais recente primeiro).</summary>
public sealed record ContratoDetalheClienteResponse(
    Guid Id,
    Guid ObraId,
    string Numero,
    decimal ValorContratado,
    DateOnly? DataAssinatura,
    decimal TotalPago,
    decimal SaldoAPagar,
    List<PagamentoClienteResponse> Pagamentos);
