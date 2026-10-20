namespace KhazObras.Application.Dtos.Contratos;

public sealed record CreateContratoRequest(
    Guid ObraId,
    string Numero,
    decimal ValorContratado,
    DateOnly? DataAssinatura);
