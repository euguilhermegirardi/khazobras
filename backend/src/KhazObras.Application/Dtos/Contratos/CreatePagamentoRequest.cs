namespace KhazObras.Application.Dtos.Contratos;

public sealed record CreatePagamentoRequest(
    decimal Valor,
    DateOnly DataPagamento,
    string? FormaPagamento,
    Guid? ReferenteMedicaoId);
