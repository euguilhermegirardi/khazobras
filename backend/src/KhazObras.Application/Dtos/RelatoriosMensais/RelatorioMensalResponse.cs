namespace KhazObras.Application.Dtos.RelatoriosMensais;

public sealed record RelatorioMensalResponse(
    Guid Id,
    Guid ObraId,
    DateOnly Competencia,
    string Conteudo,
    string Status,
    DateTime? PublishedAt,
    Guid CreatedByUserId,
    DateTime CreatedAt);