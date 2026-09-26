namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

public sealed record CreateRelatorioFotograficoRequest(
    Guid ObraId,
    string Tipo,
    Guid? EtapaId,
    string Titulo,
    DateOnly? Competencia);