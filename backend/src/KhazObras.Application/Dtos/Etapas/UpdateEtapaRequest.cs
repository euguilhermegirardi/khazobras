namespace KhazObras.Application.Dtos.Etapas;

public sealed record UpdateEtapaRequest(
    string Nome,
    int Ordem,
    decimal PercentualPeso,
    DateOnly? DataInicioPrevista,
    DateOnly? DataFimPrevista,
    DateOnly? DataInicioReal,
    DateOnly? DataFimReal,
    string Status,
    decimal PercentualConcluido);
