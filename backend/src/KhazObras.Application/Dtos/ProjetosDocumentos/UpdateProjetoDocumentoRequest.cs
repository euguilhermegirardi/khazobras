namespace KhazObras.Application.Dtos.ProjetosDocumentos;

/// <summary>
/// Edicao dos metadados de um documento de projeto (substitui os tres campos; <c>null</c> limpa tipo e etapa).
/// O arquivo, a obra e a data de envio nunca mudam (um <c>obraId</c> no JSON e ignorado).
/// </summary>
public sealed record UpdateProjetoDocumentoRequest(
    string Nome,
    string? TipoDocumento,
    Guid? EtapaId);
