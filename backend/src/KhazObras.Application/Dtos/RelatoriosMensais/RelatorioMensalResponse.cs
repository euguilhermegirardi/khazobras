namespace KhazObras.Application.Dtos.RelatoriosMensais;

/// <summary>Visao Admin/Master. O cliente recebe <see cref="RelatorioMensalClienteResponse"/> (sem ids de usuario).</summary>
public sealed record RelatorioMensalResponse(
    Guid Id,
    Guid ObraId,
    DateOnly Competencia,
    string Conteudo,
    string Status,
    DateTime? PublishedAt,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    DateTime UpdatedAt);
