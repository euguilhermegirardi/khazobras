namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

/// <summary>
/// Visao do relatorio fotografico (admin e cliente: o schema nao tem rascunho/publicacao, entao todos veem o mesmo).
/// Nunca expoe a chave do bucket. Fotos em ordem estavel (ordem, criacao, id).
/// </summary>
public sealed record RelatorioFotograficoResponse(
    Guid Id,
    Guid ObraId,
    string Tipo,
    Guid? EtapaId,
    string Titulo,
    DateOnly? Competencia,
    DateTime CreatedAt,
    List<FotoResponse> Fotos)
{
    public int QuantidadeFotos => Fotos.Count;
}
