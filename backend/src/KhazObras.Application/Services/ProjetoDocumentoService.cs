using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.ProjetosDocumentos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class ProjetoDocumentoService
{
    private readonly IProjetoDocumentoRepository _repository;
    private readonly IEtapaRepository _etapaRepository;
    private readonly IStorageService _storageService;

    public ProjetoDocumentoService(IProjetoDocumentoRepository repository, IEtapaRepository etapaRepository, IStorageService storageService)
    {
        _repository = repository;
        _etapaRepository = etapaRepository;
        _storageService = storageService;
    }

    /// <summary>True se a etapa existe e pertence a obra informada (uma etapa de outra obra nao pode receber o documento).</summary>
    public async Task<bool> EtapaPertenceAObraAsync(Guid etapaId, Guid obraId) =>
        await _etapaRepository.GetByIdAndObraAsync(etapaId, obraId) is not null;

    public async Task<ProjetoDocumentoResponse> UploadAsync(Guid obraId, Guid? etapaId, Stream content, string fileName, string contentType, string? tipoDocumento)
    {
        // Chave nova: .../{guid}{ext}, sem o nome original (que segue em Nome). Chaves antigas {guid}-{nome} continuam legiveis.
        var storageKey = $"obras/{obraId}/projetos/{Guid.NewGuid()}{SafeExtension(fileName)}";
        await _storageService.UploadAsync(storageKey, content, contentType);

        var documento = new ProjetoDocumento
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            EtapaId = etapaId,
            Nome = fileName,
            StorageKey = storageKey,
            TipoDocumento = tipoDocumento,
            UploadedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(documento);
        return ToResponse(created);
    }

    /// <summary>Resolve so a obra do documento (query enxuta); o endpoint valida o acesso a ela antes do download.</summary>
    public Task<Guid?> ResolveAsync(Guid id) => _repository.GetObraIdByIdAsync(id);

    /// <summary>
    /// Devolve null se o documento nao existir ou nao pertencer a obra informada (a mesma que foi autorizada).
    /// Nome: o do documento, ou <c>projeto-{id}{ext}</c> se vier vazio ou com caracteres de controle/separadores.
    /// Content type derivado da extensao (o upload valida extensao + MIME + magic bytes).
    /// </summary>
    public async Task<(Stream Content, string FileName, string ContentType)?> DownloadAsync(Guid id, Guid obraId)
    {
        var documento = await _repository.GetByIdAndObraAsync(id, obraId);
        if (documento is null)
        {
            return null;
        }

        var extension = SafeExtension(documento.Nome);
        var nome = documento.Nome;
        var nomeSeguro = !string.IsNullOrWhiteSpace(nome)
            && nome.Length <= 200
            && nome.IndexOfAny(['/', '\\']) < 0
            && !nome.Any(char.IsControl);
        var fileName = nomeSeguro ? nome : $"projeto-{documento.Id}{extension}";

        var stream = await _storageService.DownloadAsync(documento.StorageKey);
        return (stream, fileName, ContentTypeFromExtension(extension));
    }

    public async Task<IReadOnlyList<ProjetoDocumentoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var documentos = await _repository.GetByObraIdAsync(obraId);
        return documentos.Select(ToResponse).ToList();
    }

    private static string SafeExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension.Length is > 1 and <= 8 && extension.Skip(1).All(char.IsAsciiLetterOrDigit) ? extension : string.Empty;
    }

    private static string ContentTypeFromExtension(string extension) => extension switch
    {
        ".pdf" => "application/pdf",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt" => "text/plain",
        _ => "application/octet-stream"
    };

    private static ProjetoDocumentoResponse ToResponse(ProjetoDocumento d) => new(
        d.Id, d.ObraId, d.EtapaId, d.Nome, d.TipoDocumento, d.UploadedAt);
}
