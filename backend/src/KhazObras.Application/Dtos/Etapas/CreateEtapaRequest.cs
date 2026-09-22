namespace KhazObras.Application.Dtos.Etapas;

public sealed record CreateEtapaRequest(
    Guid ObraId,
    string Nome,
    int Ordem,
    decimal PercentualPeso,
    DateOnly? DataInicioPrevista,
    DateOnly? DataFimPrevista);