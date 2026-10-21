namespace KhazObras.Application.Services;

/// <summary>Limites e validacoes do relatorio mensal ao cliente (colunas de <c>relatorios_mensais</c> e regras de produto).</summary>
public static class RelatorioMensalRegras
{
    /// <summary>Maximo de caracteres do conteudo (a coluna e TEXT; o limite protege o banco, o cliente e o log).</summary>
    public const int MaxConteudo = 20000;

    /// <summary>Quantos registros de auditoria o historico devolve (do mais novo para o mais antigo).</summary>
    public const int MaxItensHistorico = 100;

    /// <summary>Competencia valida: ano entre 2000 e 2100 (como Medicoes, Contratos e Financeiro).</summary>
    public static bool CompetenciaValida(DateOnly competencia) => competencia.Year is >= 2000 and <= 2100;

    /// <summary>Um relatorio por obra e mes: a competencia sempre e gravada no dia 1 (a unicidade do schema e por data exata).</summary>
    public static DateOnly NormalizarCompetencia(DateOnly competencia) => new(competencia.Year, competencia.Month, 1);

    /// <summary>
    /// Texto livre exibido ao cliente como TEXTO (nunca HTML). Recusa caracteres de controle (menos quebra de linha, retorno e
    /// tabulacao; o NUL derrubaria o INSERT) e os de direcao do texto (U+202A a U+202E e U+2066 a U+2069), que disfarcam conteudo.
    /// </summary>
    public static bool ConteudoSemCaracteresInvalidos(string? conteudo) =>
        conteudo is null || conteudo.All(c =>
            (!char.IsControl(c) || c is '\n' or '\r' or '\t')
            && c is not (>= '‪' and <= '‮')
            && c is not (>= '⁦' and <= '⁩'));
}
