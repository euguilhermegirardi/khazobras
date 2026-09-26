namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

public sealed record FotoResponse(
    Guid Id,
    DateOnly? DataFoto,
    string? Descricao,
    int Ordem,
    DateTime CreatedAt);