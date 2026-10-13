namespace KhazObras.Application.Dtos.Financeiro;

/// <summary>
/// Visao do lancamento para o CLIENTE da obra. Propositalmente sem CreatedByUserId,
/// VisivelCliente e qualquer outro campo interno. Nao adicionar campos aqui sem revisar
/// a regra "cliente nunca ve custo real/margem".
/// </summary>
public sealed record FinanceiroLancamentoClienteResponse(
    Guid Id,
    Guid ObraId,
    string Categoria,
    string Descricao,
    decimal Valor,
    DateOnly DataLancamento,
    DateOnly MesCompetencia,
    List<FinanceiroAnexoResponse> Anexos);
