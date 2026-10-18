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

    public async Task<FotoResponse> UploadFotoAsync(Guid relatorioId, Stream content, string fileName, string contentType, DateOnly? dataFoto, string? descricao, int ordem)
    {
        var relatorio = await _repository.GetByIdAsync(relatorioId)
            ?? throw new InvalidOperationException("Relatorio fotografico nao encontrado.");

        var storageKey = $"obras/{relatorio.ObraId}/relatorios-fotograficos/{relatorioId}/{Guid.NewGuid()}-{fileName}";
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

    public async Task<Guid?> ResolveFotoAsync(Guid fotoId)
    {
        var foto = await _repository.GetFotoByIdAsync(fotoId);
        if (foto is null)
        {
            return null;
        }

        var relatorio = await _repository.GetByIdAsync(foto.RelatorioFotograficoId);
        return relatorio?.ObraId;
    }

    public async Task<(Stream Content, string FileName, string ContentType)?> DownloadFotoAsync(Guid fotoId)
    {
        var foto = await _repository.GetFotoByIdAsync(fotoId);
        if (foto is null)
        {
            return null;
        }

        var stream = await _storageService.DownloadAsync(foto.StorageKey);
        return (stream, ExtractFileName(foto.StorageKey), ContentTypeFromFileName(foto.StorageKey));
    }

    // A chave tem o formato obras/{obra}/relatorios-fotograficos/{relatorio}/{guid}-{nomeOriginal}.
    private static string ExtractFileName(string storageKey)
    {
        var name = storageKey[(storageKey.LastIndexOf('/') + 1)..];
        const int guidPrefixLength = 37; // 36 do Guid + '-'
        return name.Length > guidPrefixLength && name[36] == '-' ? name[guidPrefixLength..] : name;
    }

    // Upload so aceita imagens (FileUploadValidator); o tipo vem da extensao gravada na chave.
    private static string ContentTypeFromFileName(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
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