namespace KhazObras.Application.Dtos.Financeiro;

public sealed record FinanceiroLancamentoResponse(
    Guid Id,
    Guid ObraId,
    string Categoria,
    string Descricao,
    decimal Valor,
    DateOnly DataLancamento,
    DateOnly MesCompetencia,
    Guid CreatedByUserId,
    bool VisivelCliente,
    DateTime CreatedAt,
    List<FinanceiroAnexoResponse> Anexos);