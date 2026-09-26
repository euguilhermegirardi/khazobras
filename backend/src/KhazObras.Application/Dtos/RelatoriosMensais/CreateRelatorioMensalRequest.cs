namespace KhazObras.Application.Dtos.RelatoriosMensais;

public sealed record CreateRelatorioMensalRequest(
    Guid ObraId,
    DateOnly Competencia,
    string Conteudo);