namespace KhazObras.Application.Services;

/// <summary>Limites e validacoes dos documentos de projeto (colunas de <c>projetos_documentos</c> e regras de produto).</summary>
public static class ProjetoRegras
{
    /// <summary>Maximo de documentos por obra (conferido de novo dentro da transacao que trava a obra).</summary>
    public const int MaxDocumentosPorObra = 200;

    /// <summary>Tamanho da coluna <c>projetos_documentos.nome</c> (VARCHAR(255)).</summary>
    public const int MaxNomeArquivo = 255;

    /// <summary>Tamanho da coluna <c>projetos_documentos.tipo_documento</c> (VARCHAR(50)).</summary>
    public const int MaxTipoDocumento = 50;

    /// <summary>
    /// Tipos aceitos como documento de projeto: PDF e imagens (o cliente visualiza) e Word/Excel (o cliente baixa).
    /// Fora o <c>.txt</c>, que o validador generico aceita mas nao tem assinatura para conferir.
    /// </summary>
    public static readonly string[] ExtensoesPermitidas =
        [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".doc", ".docx", ".xls", ".xlsx"];

    public static bool ExtensaoPermitida(string extension) =>
        ExtensoesPermitidas.Contains(extension, StringComparer.OrdinalIgnoreCase);

    /// <summary>Extensao em minusculas (ex.: ".pdf") ou vazio se nao for uma extensao simples (ate 7 letras/digitos).</summary>
    public static string ExtensaoSegura(string nomeOuChave)
    {
        var extension = Path.GetExtension(nomeOuChave).ToLowerInvariant();
        return extension.Length is > 1 and <= 8 && extension.Skip(1).All(char.IsAsciiLetterOrDigit) ? extension : string.Empty;
    }

    /// <summary>Nome sem separadores de caminho nem caracteres de controle (vira nome de download).</summary>
    public static bool NomeSemCaracteresInvalidos(string nome) =>
        nome.IndexOfAny(['/', '\\']) < 0 && !nome.Any(char.IsControl);

    /// <summary>Texto vazio ou so espacos vira null; o resto sai sem espacos nas pontas.</summary>
    public static string? NormalizarTipoDocumento(string? tipo)
    {
        var texto = tipo?.Trim();
        return string.IsNullOrEmpty(texto) ? null : texto;
    }

    /// <summary>Tipo do documento: ate 50 caracteres, sem caracteres de controle (null/vazio e valido: sem tipo).</summary>
    public static bool TipoDocumentoValido(string? tipo)
    {
        var texto = NormalizarTipoDocumento(tipo);
        return texto is null || (texto.Length <= MaxTipoDocumento && !texto.Any(char.IsControl));
    }

    /// <summary>Nome de arquivo recebido no upload: 1 a 255 caracteres, sem barras nem controle.</summary>
    public static bool NomeArquivoValido(string? nome) =>
        !string.IsNullOrWhiteSpace(nome) && nome.Length <= MaxNomeArquivo && NomeSemCaracteresInvalidos(nome);
}
