namespace KhazObras.Application.Dtos.Contratos;

/// <summary>
/// Visao Admin/Master do contrato. <c>TotalPago</c> vem de SUM no SQL; <c>SaldoAPagar</c> = valorContratado - totalPago
/// (pode ser negativo: adiantamentos/aditivos nao sao bloqueados). A <c>storage_key</c> nao e exposta (sem documento no V1).
/// </summary>
public sealed record ContratoResponse(
    Guid Id,
    Guid ObraId,
    string Numero,
    decimal ValorContratado,
    DateOnly? DataAssinatura,
    decimal TotalPago,
    decimal SaldoAPagar,
    DateTime CreatedAt,
    DateTime UpdatedAt);
