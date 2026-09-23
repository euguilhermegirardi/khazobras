namespace KhazObras.Application.Dtos.Financeiro;

public sealed record CreateFinanceiroLancamentoRequest(
    Guid ObraId,
    string Categoria,
    string Descricao,
    decimal Valor,
    DateOnly DataLancamento,
    DateOnly MesCompetencia);