namespace KhazObras.Application.Dtos.Financeiro;

/// <summary>
/// Edicao de um lancamento. Mesmos campos do POST, exceto <c>ObraId</c> (um lancamento nunca troca de obra; se vier
/// no JSON, e ignorado). <c>VisivelCliente</c> omitido/null mantem o valor atual.
/// </summary>
public sealed record UpdateFinanceiroLancamentoRequest(
    string Categoria,
    string Descricao,
    decimal Valor,
    DateOnly DataLancamento,
    DateOnly MesCompetencia,
    bool? VisivelCliente = null);
