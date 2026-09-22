namespace KhazObras.Application.Dtos.Medicoes;

public sealed record MedicaoResponse(
    Guid Id,
    Guid ObraId,
    Guid? EtapaId,
    int Numero,
    DateOnly Competencia,
    decimal ValorTotal,
    string Status,
    DateTime? ApprovedAt,
    Guid? ApprovedByUserId,
    string? NfNumber,
    DateTime? NfIssuedAt,
    DateTime CreatedAt,
    List<MedicaoItemResponse> Itens);