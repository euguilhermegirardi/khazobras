namespace KhazObras.Application.Dtos.RelatoriosMensais;

/// <summary>
/// Edicao de um relatorio em rascunho (substitui os dois campos). A obra, o status e o autor nunca mudam
/// (um <c>obraId</c> ou <c>status</c> no JSON e ignorado). A competencia e gravada no dia 1 do mes informado.
/// </summary>
public sealed record UpdateRelatorioMensalRequest(
    DateOnly Competencia,
    string Conteudo);
