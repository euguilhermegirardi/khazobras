using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.ProjetosDocumentos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class ProjetoDocumentoService
{
    private readonly IProjetoDocumentoRepository _repository;
    private readonly IStorageService _storageService;

    public ProjetoDocumentoService(IProjetoDocumentoRepository repository, IStorageService storageService)
    {
        _repository = repository;
        _storageService = storageService;
    }

    public async Task<ProjetoDocumentoResponse> UploadAsync(Guid obraId, Guid? etapaId, Stream content, string fileName, string contentType, string? tipoDocumento)
    {
        var storageKey = $"obras/{obraId}/projetos/{Guid.NewGuid()}-{fileName}";
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

    public async Task<(Stream Content, string FileName, string? ContentType)?> DownloadAsync(Guid id)
    {
        var documento = await _repository.GetByIdAsync(id);
        if (documento is null)
        {
            return null;
        }

        var stream = await _storageService.DownloadAsync(documento.StorageKey);
        return (stream, documento.Nome, null);
    }

    public async Task<IReadOnlyList<ProjetoDocumentoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var documentos = await _repository.GetByObraIdAsync(obraId);
        return documentos.Select(ToResponse).ToList();
    }

    private static ProjetoDocumentoResponse ToResponse(ProjetoDocumento d) => new(
        d.Id, d.ObraId, d.EtapaId, d.Nome, d.TipoDocumento, d.UploadedAt);
}