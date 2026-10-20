namespace KhazObras.Application.Dtos.Financeiro;

/// <summary>
/// Resumo ADMIN do financeiro da obra. Contem custo real: nunca devolver ao cliente (o endpoint e AdminOrMaster).
/// "Liberado" = <c>visivel_cliente</c>.
/// </summary>
public sealed record FinanceiroResumoResponse(
    decimal TotalLancado,
    decimal TotalLiberadoCliente,
    decimal TotalNaoLiberado,
    int QuantidadeLancamentos,
    int QuantidadeLiberada,
    int QuantidadeNaoLiberada);
