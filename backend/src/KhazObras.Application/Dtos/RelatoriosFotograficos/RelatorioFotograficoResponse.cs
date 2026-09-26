namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

public sealed record RelatorioFotograficoResponse(
    Guid Id,
    Guid ObraId,
    string Tipo,
    Guid? EtapaId,
    string Titulo,
    DateOnly? Competencia,
    DateTime CreatedAt,
    List<FotoResponse> Fotos);