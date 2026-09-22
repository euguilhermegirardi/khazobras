namespace KhazObras.Application.Dtos.Medicoes;

public sealed record CreateMedicaoRequest(
    Guid ObraId,
    Guid? EtapaId,
    int Numero,
    DateOnly Competencia,
    List<CreateMedicaoItemRequest> Itens);