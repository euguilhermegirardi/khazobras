namespace KhazObras.Application.Dtos.Contratos;

/// <summary>
/// Visao do CLIENTE do pagamento: o que a empresa recebeu dele (valor contratado/recebido, nunca custo real nem margem).
/// Sem <c>ContratoId</c> repetido nem <c>CreatedAt</c> interno.
/// </summary>
public sealed record PagamentoClienteResponse(
    Guid Id,
    Guid? ReferenteMedicaoId,
    int? ReferenteMedicaoNumero,
    decimal Valor,
    DateOnly DataPagamento,
    string? FormaPagamento);
