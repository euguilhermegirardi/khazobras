namespace KhazObras.Domain.Entities;

/// <summary>
/// Agregado do financeiro de uma obra (custo real: somente Admin/Master). "Liberado" = visivel_cliente.
/// </summary>
public sealed record FinanceiroResumo(
    decimal TotalLancado,
    decimal TotalLiberadoCliente,
    decimal TotalNaoLiberado,
    int QuantidadeLancamentos,
    int QuantidadeLiberada,
    int QuantidadeNaoLiberada);
