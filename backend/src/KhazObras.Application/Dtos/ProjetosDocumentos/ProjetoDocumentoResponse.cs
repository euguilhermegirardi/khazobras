namespace KhazObras.Application.Dtos.ProjetosDocumentos;

public sealed record ProjetoDocumentoResponse(
    Guid Id,
    Guid ObraId,
    Guid? EtapaId,
    string Nome,
    string? TipoDocumento,
    DateTime UploadedAt);