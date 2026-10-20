namespace KhazObras.Application.Dtos.Contratos;

/// <summary>Visao Admin/Master do pagamento recebido.</summary>
public sealed record PagamentoResponse(
    Guid Id,
    Guid ContratoId,
    Guid? ReferenteMedicaoId,
    int? ReferenteMedicaoNumero,
    decimal Valor,
    DateOnly DataPagamento,
    string? FormaPagamento,
    DateTime CreatedAt);
