namespace KhazObras.Application.Services;

/// <summary>Limites e validacoes das fotos do relatorio fotografico (colunas da tabela <c>fotos</c> e regras de produto).</summary>
public static class FotoRegras
{
    public const int MaxFotosPorRelatorio = 100;

    /// <summary>Tamanho da coluna <c>fotos.descricao</c> (VARCHAR(255)).</summary>
    public const int MaxDescricao = 255;

    public const int MaxNomeArquivo = 255;

    /// <summary>Maximo de fotos na reordenacao em lote.</summary>
    public const int MaxFotosNoLote = 200;

    public const int OrdemMaxima = 100_000;

    public static readonly DateOnly DataMinima = new(2000, 1, 1);

    public static readonly string[] ExtensoesImagem = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    public static readonly string[] ContentTypesImagem = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    public static bool IsImagem(string extension, string contentType) =>
        ExtensoesImagem.Contains(extension) && ContentTypesImagem.Contains(contentType, StringComparer.OrdinalIgnoreCase);

    /// <summary>Texto vazio ou so espacos vira null; o resto sai sem espacos nas pontas.</summary>
    public static string? NormalizarDescricao(string? descricao)
    {
        var texto = descricao?.Trim();
        return string.IsNullOrEmpty(texto) ? null : texto;
    }

    /// <summary>
    /// Valida descricao (ate 255), data da foto (2000-01-01 ate hoje + 1 dia, UTC) e ordem (0..<see cref="OrdemMaxima"/>).
    /// Devolve um dicionario campo -> mensagens (vazio = tudo certo); valores nulos nao sao validados.
    /// </summary>
    public static Dictionary<string, string[]> Erros(string? descricao, DateOnly? dataFoto, int? ordem)
    {
        var erros = new Dictionary<string, string[]>();

        if (NormalizarDescricao(descricao) is { Length: > MaxDescricao })
        {
            erros["Descricao"] = [$"A descricao deve ter no maximo {MaxDescricao} caracteres."];
        }

        if (dataFoto is { } data)
        {
            var limite = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
            if (data < DataMinima || data > limite)
            {
                erros["DataFoto"] = ["A data da foto deve estar entre 2000-01-01 e amanha."];
            }
        }

        if (ordem is { } o && (o < 0 || o > OrdemMaxima))
        {
            erros["Ordem"] = [$"A ordem deve estar entre 0 e {OrdemMaxima}."];
        }

        return erros;
    }
}
