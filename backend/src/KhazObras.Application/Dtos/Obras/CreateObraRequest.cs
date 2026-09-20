namespace KhazObras.Application.Dtos.Obras;

public sealed record CreateObraRequest(
    string Nome,
    string? Endereco,
    decimal ValorContratado,
    DateOnly? DataInicio,
    DateOnly? DataPrevisaoTermino);