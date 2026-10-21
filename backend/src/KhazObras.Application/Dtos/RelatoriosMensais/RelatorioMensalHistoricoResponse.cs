namespace KhazObras.Application.Dtos.RelatoriosMensais;

/// <summary>
/// Um registro do historico de um relatorio (so Admin/Master). Vem da auditoria: <c>acao</c> e uma de
/// relatorio_mensal_criado, relatorio_mensal_editado, relatorio_mensal_publicado; <c>campos</c> so existe na edicao
/// (nomes dos campos alterados, nunca o texto). <c>UserName</c> e null se o usuario nao for mais encontrado.
/// </summary>
public sealed record RelatorioMensalHistoricoResponse(
    string Acao,
    Guid? UserId,
    string? UserName,
    DateTime CreatedAt,
    IReadOnlyList<string> Campos);
