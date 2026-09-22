namespace KhazObras.Application.Dtos.Etapas;

public sealed record EtapaResponse(
    Guid Id,
    Guid ObraId,
    string Nome,
    int Ordem,
    decimal PercentualPeso,
    DateOnly? DataInicioPrevista,
    DateOnly? DataInicioReal,
    DateOnly? DataFimPrevista,
    DateOnly? DataFimReal,
    string Status,
    DateTime CreatedAt);