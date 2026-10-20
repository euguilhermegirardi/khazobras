namespace KhazObras.Application.Dtos.Contratos;

/// <summary>
/// Visao do CLIENTE do contrato: so valores contratados/recebidos (regra 7 do CLAUDE.md). Sem storage_key, sem
/// datas internas de auditoria, sem ids de usuario. O saldo pode ser negativo (pago acima do contratado).
/// </summary>
public sealed record ContratoClienteResponse(
    Guid Id,
    Guid ObraId,
    string Numero,
    decimal ValorContratado,
    DateOnly? DataAssinatura,
    decimal TotalPago,
    decimal SaldoAPagar);
