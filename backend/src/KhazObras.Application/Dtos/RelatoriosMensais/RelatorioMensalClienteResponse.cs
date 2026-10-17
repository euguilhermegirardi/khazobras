namespace KhazObras.Application.Dtos.RelatoriosMensais;

/// <summary>Visão do cliente: sem ids internos de usuário (CreatedByUserId).</summary>
public sealed record RelatorioMensalClienteResponse(
    Guid Id,
    Guid ObraId,
    DateOnly Competencia,
    string Conteudo,
    string Status,
    DateTime? PublishedAt,
    DateTime CreatedAt);
