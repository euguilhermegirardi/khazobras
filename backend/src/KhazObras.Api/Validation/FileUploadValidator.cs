namespace KhazObras.Api.Validation;

public static class FileUploadValidator
{
    private const long MaxSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif",
        ".pdf",
        ".doc", ".docx",
        ".xls", ".xlsx",
        ".txt"
    };

    public static bool IsValid(IFormFile file, out string? error)
    {
        if (file is null)
        {
            error = "Arquivo nao informado.";
            return false;
        }

        if (file.Length <= 0)
        {
            error = "Arquivo vazio.";
            return false;
        }

        if (file.Length > MaxSizeBytes)
        {
            error = "Arquivo excede o tamanho maximo de 10MB.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(file.FileName))
        {
            error = "Nome do arquivo nao informado.";
            return false;
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            error = $"Extensao de arquivo nao permitida: {extension}.";
            return false;
        }

        if (!AllowedContentTypes.Contains(file.ContentType))
        {
            error = $"Tipo de arquivo nao permitido: {file.ContentType}.";
            return false;
        }

        if (!IsCompatibleExtensionAndContentType(file.FileName, file.ContentType))
        {
            error = $"Extensao e tipo de arquivo incompatíveis: {file.FileName} ({file.ContentType}).";
            return false;
        }

        using var stream = file.OpenReadStream();
        var buffer = new byte[16];
        var bytesRead = stream.Read(buffer, 0, buffer.Length);

        if (bytesRead <= 0)
        {
            error = "Arquivo vazio ou ilegivel.";
            return false;
        }

        if (!MatchesMagicBytes(buffer, bytesRead, file.ContentType, extension))
        {
            error = "Conteudo do arquivo nao corresponde ao tipo informado.";
            return false;
        }

        error = null;
        return true;
    }

    private static bool IsCompatibleExtensionAndContentType(string fileName, string contentType)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var type = contentType.ToLowerInvariant();

        return extension switch
        {
            ".jpg" or ".jpeg" => type is "image/jpeg",
            ".png" => type is "image/png",
            ".webp" => type is "image/webp",
            ".gif" => type is "image/gif",
            ".pdf" => type is "application/pdf",
            ".doc" => type is "application/msword",
            ".docx" => type is "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => type is "application/vnd.ms-excel",
            ".xlsx" => type is "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt" => type is "text/plain",
            _ => false
        };
    }

    private static bool MatchesMagicBytes(byte[] buffer, int bytesRead, string contentType, string extension)
    {
        var type = contentType.ToLowerInvariant();
        if (type.Contains("jpeg") || type.Contains("jpg"))
        {
            return bytesRead >= 2 && buffer[0] == 0xFF && buffer[1] == 0xD8;
        }

        if (type.Contains("png"))
        {
            return bytesRead >= 8 && buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4E && buffer[3] == 0x47 && buffer[4] == 0x0D && buffer[5] == 0x0A && buffer[6] == 0x1A && buffer[7] == 0x0A;
        }

        if (type.Contains("gif"))
        {
            // GIF87a ou GIF89a
            return bytesRead >= 6
                && buffer[0] == 0x47 && buffer[1] == 0x49 && buffer[2] == 0x46
                && buffer[3] == 0x38 && (buffer[4] == 0x37 || buffer[4] == 0x39)
                && buffer[5] == 0x61;
        }

        if (type.Contains("webp"))
        {
            return bytesRead >= 12 && buffer[0] == 0x52 && buffer[1] == 0x49 && buffer[2] == 0x46 && buffer[3] == 0x46 && buffer[8] == 0x57 && buffer[9] == 0x45 && buffer[10] == 0x42 && buffer[11] == 0x50;
        }

        if (type.Contains("pdf"))
        {
            return bytesRead >= 4 && buffer[0] == 0x25 && buffer[1] == 0x50 && buffer[2] == 0x44 && buffer[3] == 0x46;
        }

        if (type.Contains("text") || extension.Equals(".txt", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (type.Contains("officedocument"))
        {
            // .docx e .xlsx sao arquivos ZIP (PK\x03\x04)
            return bytesRead >= 4
                && buffer[0] == 0x50 && buffer[1] == 0x4B && buffer[2] == 0x03 && buffer[3] == 0x04;
        }

        if (type.Contains("word") || type.Contains("excel"))
        {
            // .doc e .xls antigos (OLE2: D0 CF 11 E0)
            return bytesRead >= 4
                && buffer[0] == 0xD0 && buffer[1] == 0xCF && buffer[2] == 0x11 && buffer[3] == 0xE0;
        }

        return false;
    }
}