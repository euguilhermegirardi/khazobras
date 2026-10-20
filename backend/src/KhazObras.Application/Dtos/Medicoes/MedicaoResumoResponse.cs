namespace KhazObras.Application.Dtos.Medicoes;

/// <summary>Linha da lista de acompanhamento do admin (sem itens). Somente Admin/Master.</summary>
public sealed record MedicaoResumoResponse(
    Guid Id,
    Guid ObraId,
    Guid? EtapaId,
    string? EtapaNome,
    int Numero,
    DateOnly Competencia,
    decimal ValorTotal,
    string Status,
    int QuantidadeItens,
    DateTime CreatedAt,
    DateTime? ApprovedAt,
    DateTime? NfIssuedAt,
    string? NfNumber);
