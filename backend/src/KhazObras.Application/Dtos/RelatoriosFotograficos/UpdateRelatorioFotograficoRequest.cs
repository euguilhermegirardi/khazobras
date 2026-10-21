namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

/// <summary>Edicao dos metadados (a obra nunca troca; um eventual obraId no JSON e ignorado).</summary>
public sealed record UpdateRelatorioFotograficoRequest(
    string Tipo,
    Guid? EtapaId,
    string Titulo,
    DateOnly? Competencia);
