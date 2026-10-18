using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class RelatorioFotograficoService
{
    private readonly IRelatorioFotograficoRepository _repository;
    private readonly IStorageService _storageService;

    public RelatorioFotograficoService(IRelatorioFotograficoRepository repository, IStorageService storageService)
    {
        _repository = repository;
        _storageService = storageService;
    }

    public async Task<RelatorioFotograficoResponse> CreateAsync(CreateRelatorioFotograficoRequest request)
    {
        var relatorio = new RelatorioFotografico
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Tipo = request.Tipo.ToLowerInvariant(),
            EtapaId = request.EtapaId,
            Titulo = request.Titulo,
            Competencia = request.Competencia,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(relatorio);
        return ToResponse(created, []);
    }

    public async Task<RelatorioFotograficoResponse?> GetByIdAsync(Guid id)
    {
        var relatorio = await _repository.GetByIdAsync(id);
        return relatorio is null ? null : ToResponse(relatorio, relatorio.Fotos);
    }

    public async Task<IReadOnlyList<RelatorioFotograficoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = await _repository.GetByObraIdAsync(obraId);
        return relatorios.Select(r => ToResponse(r, r.Fotos)).ToList();
    }

    public async Task<FotoResponse> UploadFotoAsync(Guid relatorioId, Stream content, string extension, string contentType, DateOnly? dataFoto, string? descricao, int ordem)
    {
        var relatorio = await _repository.GetByIdAsync(relatorioId)
            ?? throw new InvalidOperationException("Relatorio fotografico nao encontrado.");

        // extension ja vem normalizada (minusculas, ex.: ".jpg") e restrita as permitidas pelo endpoint.
        var storageKey = $"obras/{relatorio.ObraId}/relatorios-fotograficos/{relatorioId}/{Guid.NewGuid()}{extension}";
        await _storageService.UploadAsync(storageKey, content, contentType);

        var foto = new Foto
        {
            Id = Guid.NewGuid(),
            RelatorioFotograficoId = relatorioId,
            StorageKey = storageKey,
            DataFoto = dataFoto,
            Descricao = descricao,
            Ordem = ordem,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.AddFotoAsync(foto);
        return new FotoResponse(created.Id, created.DataFoto, created.Descricao, created.Ordem, created.CreatedAt);
    }

    // Resolve so a obra da foto (query enxuta); o endpoint valida o acesso a ela antes do download.
    public Task<Guid?> ResolveFotoAsync(Guid fotoId) => _repository.GetObraIdByFotoIdAsync(fotoId);

    // Devolve null se a foto nao existir OU nao pertencer a obra informada (a mesma obra que foi autorizada).
    public async Task<(Stream Content, string FileName, string ContentType)?> DownloadFotoAsync(Guid fotoId, Guid obraId)
    {
        var foto = await _repository.GetFotoByIdAndObraAsync(fotoId, obraId);
        if (foto is null)
        {
            return null;
        }

        var extension = Path.GetExtension(foto.StorageKey).ToLowerInvariant();
        var contentType = ContentTypeFromExtension(extension);
        var fileName = contentType == "application/octet-stream" ? $"foto-{foto.Id}" : $"foto-{foto.Id}{extension}";

        var stream = await _storageService.DownloadAsync(foto.StorageKey);
        return (stream, fileName, contentType);
    }

    // Chaves novas: .../{guid}{ext}; chaves antigas: .../{guid}-{nomeOriginal}. Em ambas o tipo sai da extensao.
    // O upload so aceita imagens (endpoint); o nome original nunca volta ao cliente.
    private static string ContentTypeFromExtension(string extension) => extension switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        _ => "application/octet-stream"
    };

    private static RelatorioFotograficoResponse ToResponse(RelatorioFotografico r, List<Foto> fotos) => new(
        r.Id, r.ObraId, r.Tipo, r.EtapaId, r.Titulo, r.Competencia, r.CreatedAt,
        fotos.Select(f => new FotoResponse(f.Id, f.DataFoto, f.Descricao, f.Ordem, f.CreatedAt)).ToList());
}