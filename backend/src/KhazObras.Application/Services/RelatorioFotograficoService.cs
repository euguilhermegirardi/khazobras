using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public enum RelatorioCreateStatus
{
    Created,
    ObraNaoEncontrada,
    EtapaInvalida
}

public sealed record RelatorioCreateResult(RelatorioCreateStatus Status, RelatorioFotograficoResponse? Relatorio);

public enum RelatorioUpdateStatus
{
    Updated,
    NaoEncontrado,
    EtapaInvalida
}

public sealed record RelatorioUpdateResult(RelatorioUpdateStatus Status, RelatorioFotograficoResponse? Relatorio);

public enum FotoUploadStatus
{
    Created,
    RelatorioNaoEncontrado,
    LimiteExcedido,
    NomeArquivoInvalido
}

public sealed record FotoUploadResult(FotoUploadStatus Status, FotoResponse? Foto);

public sealed class RelatorioFotograficoService
{
    private const string EntidadeAuditoria = "relatorio_fotografico";

    private readonly IRelatorioFotograficoRepository _repository;
    private readonly IStorageService _storageService;
    private readonly IEtapaRepository _etapaRepository;
    private readonly IObraRepository _obraRepository;
    private readonly LogAuditoriaService _auditoria;

    public RelatorioFotograficoService(
        IRelatorioFotograficoRepository repository,
        IStorageService storageService,
        IEtapaRepository etapaRepository,
        IObraRepository obraRepository,
        LogAuditoriaService auditoria)
    {
        _repository = repository;
        _storageService = storageService;
        _etapaRepository = etapaRepository;
        _obraRepository = obraRepository;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Cria o relatorio. O endpoint ja validou acesso a obra e o corpo; aqui: obra inexistente e etapa que nao e desta obra
    /// (inexistente ou de outra obra, indistinguiveis).
    /// </summary>
    public async Task<RelatorioCreateResult> CreateAsync(CreateRelatorioFotograficoRequest request)
    {
        if (await _obraRepository.GetByIdAsync(request.ObraId) is null)
        {
            return new RelatorioCreateResult(RelatorioCreateStatus.ObraNaoEncontrada, null);
        }

        if (!await EtapaPertenceAObraAsync(request.EtapaId, request.ObraId))
        {
            return new RelatorioCreateResult(RelatorioCreateStatus.EtapaInvalida, null);
        }

        var relatorio = new RelatorioFotografico
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Tipo = request.Tipo.ToLowerInvariant(),
            EtapaId = request.EtapaId,
            Titulo = request.Titulo.Trim(),
            Competencia = request.Competencia,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(relatorio);
        return new RelatorioCreateResult(RelatorioCreateStatus.Created, ToResponse(created, []));
    }

    /// <summary>Resolve so a obra do relatorio (query enxuta); o endpoint valida o acesso a ela antes de ler/alterar.</summary>
    public Task<Guid?> ResolveRelatorioAsync(Guid id) => _repository.GetObraIdByIdAsync(id);

    /// <summary>Devolve null se o relatorio nao existir OU nao for da obra informada (a que foi autorizada).</summary>
    public async Task<RelatorioFotograficoResponse?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var relatorio = await _repository.GetByIdAndObraAsync(id, obraId);
        return relatorio is null ? null : ToResponse(relatorio, relatorio.Fotos);
    }

    public async Task<IReadOnlyList<RelatorioFotograficoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = await _repository.GetByObraIdAsync(obraId);
        return relatorios.Select(r => ToResponse(r, r.Fotos)).ToList();
    }

    /// <summary>
    /// Edita tipo/etapa/titulo/competencia (a obra nunca muda). Auditoria <c>relatorio_fotografico_editado</c> so com ids e
    /// NOMES dos campos alterados (sem titulo). Nada alterado = sem registro.
    /// </summary>
    public async Task<RelatorioUpdateResult> UpdateAsync(Guid id, Guid obraId, UpdateRelatorioFotograficoRequest request, Guid actorUserId)
    {
        var atual = await _repository.GetByIdAndObraAsync(id, obraId);
        if (atual is null)
        {
            return new RelatorioUpdateResult(RelatorioUpdateStatus.NaoEncontrado, null);
        }

        if (!await EtapaPertenceAObraAsync(request.EtapaId, obraId))
        {
            return new RelatorioUpdateResult(RelatorioUpdateStatus.EtapaInvalida, null);
        }

        var novo = new RelatorioFotografico
        {
            Id = atual.Id,
            ObraId = atual.ObraId,
            Tipo = request.Tipo.ToLowerInvariant(),
            EtapaId = request.EtapaId,
            Titulo = request.Titulo.Trim(),
            Competencia = request.Competencia,
            CreatedAt = atual.CreatedAt
        };

        var campos = new List<string>();
        if (!string.Equals(novo.Tipo, atual.Tipo, StringComparison.Ordinal)) campos.Add("tipo");
        if (novo.EtapaId != atual.EtapaId) campos.Add("etapaId");
        if (!string.Equals(novo.Titulo, atual.Titulo, StringComparison.Ordinal)) campos.Add("titulo");
        if (novo.Competencia != atual.Competencia) campos.Add("competencia");

        if (!await _repository.UpdateAsync(novo))
        {
            return new RelatorioUpdateResult(RelatorioUpdateStatus.NaoEncontrado, null);
        }

        if (campos.Count > 0)
        {
            var detalhes = JsonSerializer.Serialize(new { obraId, campos });
            await _auditoria.RegistrarAsync(actorUserId, "relatorio_fotografico_editado", EntidadeAuditoria, id, detalhes);
        }

        return new RelatorioUpdateResult(RelatorioUpdateStatus.Updated, ToResponse(novo, atual.Fotos));
    }

    /// <summary>
    /// Exclui o relatorio (hard delete; fotos saem por CASCADE e os arquivos do R2 sao apagados em seguida). Auditoria
    /// <c>relatorio_fotografico_excluido</c> so com ids e quantidade de fotos. Devolve null se nao existir nessa obra.
    /// </summary>
    public async Task<StorageCleanupResult?> DeleteAsync(Guid id, Guid obraId, Guid actorUserId)
    {
        var chaves = await _repository.DeleteAsync(id, obraId);
        if (chaves is null)
        {
            return null;
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, quantidadeFotos = chaves.Count });
        await _auditoria.RegistrarAsync(actorUserId, "relatorio_fotografico_excluido", EntidadeAuditoria, id, detalhes);

        return await RemoverDoStorageAsync(chaves);
    }

    /// <summary>
    /// Sobe a imagem para o R2 e registra a foto. O relatorio precisa ser da obra informada (a que foi autorizada) e ter menos
    /// de <see cref="FotoRegras.MaxFotosPorRelatorio"/> fotos; o limite e conferido de novo dentro de uma transacao que trava o
    /// relatorio (corrida). Sem <paramref name="ordem"/>, a foto vai para o fim. O endpoint ja validou acesso, tipo de imagem e metadados.
    /// </summary>
    public async Task<FotoUploadResult> UploadFotoAsync(
        Guid relatorioId, Guid obraId, Stream content, string fileName, string contentType, DateOnly? dataFoto, string? descricao, int? ordem)
    {
        var total = await _repository.CountFotosAsync(relatorioId, obraId);
        if (total is null)
        {
            return new FotoUploadResult(FotoUploadStatus.RelatorioNaoEncontrado, null);
        }

        if (total >= FotoRegras.MaxFotosPorRelatorio)
        {
            return new FotoUploadResult(FotoUploadStatus.LimiteExcedido, null);
        }

        // Nome vazio ou maior que 255: recusa ANTES do R2 (mesmo padrao dos anexos do Financeiro; o nome nao e gravado).
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > FotoRegras.MaxNomeArquivo)
        {
            return new FotoUploadResult(FotoUploadStatus.NomeArquivoInvalido, null);
        }

        // Extensao normalizada (minusculas, ex.: ".jpg") e restrita as permitidas pelo endpoint; o nome original nunca vira chave.
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var storageKey = $"obras/{obraId}/relatorios-fotograficos/{relatorioId}/{Guid.NewGuid()}{extension}";
        await _storageService.UploadAsync(storageKey, content, contentType);

        var foto = new Foto
        {
            Id = Guid.NewGuid(),
            RelatorioFotograficoId = relatorioId,
            StorageKey = storageKey,
            DataFoto = dataFoto,
            Descricao = FotoRegras.NormalizarDescricao(descricao),
            Ordem = ordem ?? 0,
            CreatedAt = DateTime.UtcNow
        };

        FotoInsertResult resultado;
        try
        {
            resultado = await _repository.TryAddFotoAsync(foto, obraId, FotoRegras.MaxFotosPorRelatorio, ordemNoFim: ordem is null);
        }
        catch (Exception)
        {
            // Falha do banco depois do upload: nao deixa foto orfa no R2 e propaga o erro original.
            await RemoverDoStorageAsync([storageKey]);
            throw;
        }

        if (resultado != FotoInsertResult.Added)
        {
            // Corrida (outro upload ocupou a ultima vaga) ou relatorio apagado no meio: nao deixa arquivo orfao no R2.
            await RemoverDoStorageAsync([storageKey]);
            return new FotoUploadResult(
                resultado == FotoInsertResult.LimiteExcedido ? FotoUploadStatus.LimiteExcedido : FotoUploadStatus.RelatorioNaoEncontrado,
                null);
        }

        return new FotoUploadResult(FotoUploadStatus.Created, ToFotoResponse(foto));
    }

    // Resolve so a obra da foto (query enxuta); o endpoint valida o acesso a ela antes do download/edicao/exclusao.
    public Task<Guid?> ResolveFotoAsync(Guid fotoId) => _repository.GetObraIdByFotoIdAsync(fotoId);

    /// <summary>
    /// Altera so os campos enviados (preso a obra no SQL). Auditoria <c>foto_editada</c> com ids e nomes dos campos enviados
    /// (sem descricao). Devolve null se a foto nao existir nessa obra.
    /// </summary>
    public async Task<FotoResponse?> UpdateFotoAsync(Guid fotoId, Guid obraId, UpdateFotoRequest request, Guid actorUserId)
    {
        var foto = await _repository.UpdateFotoAsync(fotoId, obraId, request);
        if (foto is null)
        {
            return null;
        }

        var campos = new List<string>();
        if (request.DescricaoInformada) campos.Add("descricao");
        if (request.DataFotoInformada) campos.Add("dataFoto");
        if (request.OrdemInformada) campos.Add("ordem");

        var detalhes = JsonSerializer.Serialize(new { obraId, fotoId, campos });
        await _auditoria.RegistrarAsync(actorUserId, "foto_editada", EntidadeAuditoria, foto.RelatorioFotograficoId, detalhes);

        return ToFotoResponse(foto);
    }

    /// <summary>
    /// Remove a foto (preso a obra no SQL) e depois o arquivo do R2 (falha no R2 vira contagem, nao 500). Auditoria
    /// <c>foto_removida</c> com ids. Devolve null se a foto nao existir nessa obra.
    /// </summary>
    public async Task<StorageCleanupResult?> DeleteFotoAsync(Guid fotoId, Guid obraId, Guid actorUserId)
    {
        var foto = await _repository.DeleteFotoAsync(fotoId, obraId);
        if (foto is null)
        {
            return null;
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, fotoId });
        await _auditoria.RegistrarAsync(actorUserId, "foto_removida", EntidadeAuditoria, foto.RelatorioFotograficoId, detalhes);

        return await RemoverDoStorageAsync([foto.StorageKey]);
    }

    /// <summary>
    /// Reordena em lote, tudo-ou-nada. Devolve null se alguma foto nao for deste relatorio/obra (inexistente e de outra obra
    /// sao indistinguiveis) ou se houver ids repetidos; nesse caso nada muda. Sucesso: todas as fotos do relatorio em ordem estavel.
    /// </summary>
    public async Task<IReadOnlyList<FotoResponse>?> ReordenarFotosAsync(Guid relatorioId, Guid obraId, ReordenarFotosRequest request, Guid actorUserId)
    {
        var itens = request.Fotos.Select(f => (f.Id, f.Ordem)).ToList();
        if (itens.Select(i => i.Id).Distinct().Count() != itens.Count)
        {
            return null;
        }

        if (!await _repository.ReordenarFotosAsync(relatorioId, obraId, itens))
        {
            return null;
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, quantidade = itens.Count });
        await _auditoria.RegistrarAsync(actorUserId, "fotos_reordenadas", EntidadeAuditoria, relatorioId, detalhes);

        var relatorio = await _repository.GetByIdAndObraAsync(relatorioId, obraId);
        return relatorio?.Fotos.Select(ToFotoResponse).ToList();
    }

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

    // Sem etapa informada = ok; informada precisa ser desta obra (WHERE id AND obra_id).
    private async Task<bool> EtapaPertenceAObraAsync(Guid? etapaId, Guid obraId) =>
        etapaId is null || await _etapaRepository.GetByIdAndObraAsync(etapaId.Value, obraId) is not null;

    /// <summary>
    /// Apaga arquivos do R2 sem derrubar a requisicao: o banco ja foi alterado, entao falha no storage vira contagem
    /// (o endpoint registra um aviso) em vez de 500 com o registro ja removido.
    /// </summary>
    private async Task<StorageCleanupResult> RemoverDoStorageAsync(IEnumerable<string> chaves)
    {
        var removidos = 0;
        var falhas = 0;
        foreach (var chave in chaves)
        {
            try
            {
                await _storageService.DeleteAsync(chave);
                removidos++;
            }
            catch (Exception)
            {
                falhas++;
            }
        }

        return new StorageCleanupResult(removidos, falhas);
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

    private static FotoResponse ToFotoResponse(Foto f) => new(f.Id, f.DataFoto, f.Descricao, f.Ordem, f.CreatedAt);

    private static RelatorioFotograficoResponse ToResponse(RelatorioFotografico r, List<Foto> fotos) => new(
        r.Id, r.ObraId, r.Tipo, r.EtapaId, r.Titulo, r.Competencia, r.CreatedAt,
        fotos.Select(ToFotoResponse).ToList());
}
