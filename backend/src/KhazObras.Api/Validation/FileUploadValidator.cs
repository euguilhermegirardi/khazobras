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

    public static bool IsValid(IFormFile file, out string? error)
    {
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

        if (!AllowedContentTypes.Contains(file.ContentType))
        {
            error = $"Tipo de arquivo nao permitido: {file.ContentType}.";
            return false;
        }

        error = null;
        return true;
    }
}