using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.ProjetosDocumentos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public enum ProjetoUploadStatus
{
    Created,
    ObraNaoEncontrada,
    LimiteExcedido,
    EtapaInvalida,
    NomeArquivoInvalido,
    TipoDocumentoInvalido,
    ExtensaoNaoPermitida
}

public sealed record ProjetoUploadResult(ProjetoUploadStatus Status, ProjetoDocumentoResponse? Documento);

public enum ProjetoUpdateStatus
{
    Updated,
    NaoEncontrado,
    EtapaInvalida,
    NomeInvalido
}

public sealed record ProjetoUpdateResult(ProjetoUpdateStatus Status, ProjetoDocumentoResponse? Documento);

public sealed class ProjetoDocumentoService
{
    private const string EntidadeAuditoria = "projeto_documento";

    private readonly IProjetoDocumentoRepository _repository;
    private readonly IEtapaRepository _etapaRepository;
    private readonly IStorageService _storageService;
    private readonly LogAuditoriaService _auditoria;

    public ProjetoDocumentoService(
        IProjetoDocumentoRepository repository,
        IEtapaRepository etapaRepository,
        IStorageService storageService,
        LogAuditoriaService auditoria)
    {
        _repository = repository;
        _etapaRepository = etapaRepository;
        _storageService = storageService;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Sobe o arquivo para o R2 e registra o documento. O endpoint ja validou o acesso a obra e o arquivo (tamanho, MIME, magic
    /// bytes). Aqui, tudo ANTES do R2: obra existe (404), limite de <see cref="ProjetoRegras.MaxDocumentosPorObra"/> documentos,
    /// etapa da mesma obra, nome (1 a 255, sem barras), tipo (ate 50) e extensao permitida. O limite e conferido de novo dentro
    /// de uma transacao que trava a obra (corrida); se o INSERT falhar ou o limite estourar, o objeto sai do R2.
    /// Auditoria <c>projeto_enviado</c> so com ids.
    /// </summary>
    public async Task<ProjetoUploadResult> UploadAsync(
        Guid obraId, Guid? etapaId, Stream content, string fileName, string contentType, string? tipoDocumento, Guid actorUserId)
    {
        var total = await _repository.CountByObraAsync(obraId);
        if (total is null)
        {
            return Falha(ProjetoUploadStatus.ObraNaoEncontrada);
        }

        if (total >= ProjetoRegras.MaxDocumentosPorObra)
        {
            return Falha(ProjetoUploadStatus.LimiteExcedido);
        }

        if (etapaId is not null && !await EtapaPertenceAObraAsync(etapaId.Value, obraId))
        {
            return Falha(ProjetoUploadStatus.EtapaInvalida);
        }

        // Nome vazio, maior que a coluna ou com barras/controle: recusa ANTES do R2 (senao o INSERT falharia com o arquivo ja
        // enviado). Recusa em vez de truncar, para nunca gravar um nome diferente do que foi enviado.
        if (!ProjetoRegras.NomeArquivoValido(fileName))
        {
            return Falha(ProjetoUploadStatus.NomeArquivoInvalido);
        }

        if (!ProjetoRegras.TipoDocumentoValido(tipoDocumento))
        {
            return Falha(ProjetoUploadStatus.TipoDocumentoInvalido);
        }

        // Extensao normalizada (minusculas) e restrita aos tipos de projeto; o nome original nunca vira chave.
        var extension = ProjetoRegras.ExtensaoSegura(fileName);
        if (!ProjetoRegras.ExtensaoPermitida(extension))
        {
            return Falha(ProjetoUploadStatus.ExtensaoNaoPermitida);
        }

        // Chave nova: .../{guid}{ext}, sem o nome original (que segue em Nome). Chaves antigas {guid}-{nome} continuam legiveis.
        var storageKey = $"obras/{obraId}/projetos/{Guid.NewGuid()}{extension}";
        // DWG: o MIME do navegador varia (ou vem vazio); no R2 fica sempre application/octet-stream.
        var contentTypeArmazenado = extension == ".dwg" ? "application/octet-stream" : contentType;
        await _storageService.UploadAsync(storageKey, content, contentTypeArmazenado);

        var documento = new ProjetoDocumento
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            EtapaId = etapaId,
            Nome = fileName,
            StorageKey = storageKey,
            TipoDocumento = ProjetoRegras.NormalizarTipoDocumento(tipoDocumento),
            UploadedAt = DateTime.UtcNow
        };

        ProjetoInsertResult resultado;
        try
        {
            resultado = await _repository.TryAddAsync(documento, ProjetoRegras.MaxDocumentosPorObra);
        }
        catch (Exception)
        {
            // Falha do banco depois do upload: nao deixa arquivo orfao no R2 e propaga o erro original.
            await RemoverDoStorageAsync([storageKey]);
            throw;
        }

        if (resultado != ProjetoInsertResult.Added)
        {
            // Corrida (outro upload ocupou a ultima vaga) ou obra apagada no meio: nao deixa arquivo orfao no R2.
            await RemoverDoStorageAsync([storageKey]);
            return Falha(
                resultado == ProjetoInsertResult.LimiteExcedido ? ProjetoUploadStatus.LimiteExcedido : ProjetoUploadStatus.ObraNaoEncontrada);
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, etapaId });
        await _auditoria.RegistrarAsync(actorUserId, "projeto_enviado", EntidadeAuditoria, documento.Id, detalhes);

        return new ProjetoUploadResult(ProjetoUploadStatus.Created, ToResponse(documento));
    }

    /// <summary>Resolve so a obra do documento (query enxuta); o endpoint valida o acesso a ela antes de ler/alterar/baixar.</summary>
    public Task<Guid?> ResolveAsync(Guid id) => _repository.GetObraIdByIdAsync(id);

    /// <summary>
    /// Edita nome, tipo e etapa (preso a obra no SQL; a obra, o arquivo e a data de envio nunca mudam). O nome precisa manter a
    /// extensao do arquivo (o download e o tipo de conteudo dependem dela) e a etapa precisa ser desta obra (inexistente e de
    /// outra obra, indistinguiveis). Auditoria <c>projeto_editado</c> so com ids e NOMES dos campos alterados (sem texto livre);
    /// nada alterado = sem registro.
    /// </summary>
    public async Task<ProjetoUpdateResult> UpdateAsync(Guid id, Guid obraId, UpdateProjetoDocumentoRequest request, Guid actorUserId)
    {
        var atual = await _repository.GetByIdAndObraAsync(id, obraId);
        if (atual is null)
        {
            return new ProjetoUpdateResult(ProjetoUpdateStatus.NaoEncontrado, null);
        }

        if (request.EtapaId is not null && !await EtapaPertenceAObraAsync(request.EtapaId.Value, obraId))
        {
            return new ProjetoUpdateResult(ProjetoUpdateStatus.EtapaInvalida, null);
        }

        var nome = request.Nome.Trim();
        var extensaoDoArquivo = ProjetoRegras.ExtensaoSegura(atual.StorageKey);
        if (!ProjetoRegras.NomeArquivoValido(nome)
            || (extensaoDoArquivo.Length > 0 && ProjetoRegras.ExtensaoSegura(nome) != extensaoDoArquivo))
        {
            return new ProjetoUpdateResult(ProjetoUpdateStatus.NomeInvalido, null);
        }

        var tipo = ProjetoRegras.NormalizarTipoDocumento(request.TipoDocumento);

        var campos = new List<string>();
        if (!string.Equals(nome, atual.Nome, StringComparison.Ordinal)) campos.Add("nome");
        if (!string.Equals(tipo, atual.TipoDocumento, StringComparison.Ordinal)) campos.Add("tipoDocumento");
        if (request.EtapaId != atual.EtapaId) campos.Add("etapaId");

        var atualizado = await _repository.UpdateAsync(id, obraId, nome, tipo, request.EtapaId);
        if (atualizado is null)
        {
            return new ProjetoUpdateResult(ProjetoUpdateStatus.NaoEncontrado, null);
        }

        if (campos.Count > 0)
        {
            var detalhes = JsonSerializer.Serialize(new { obraId, campos });
            await _auditoria.RegistrarAsync(actorUserId, "projeto_editado", EntidadeAuditoria, id, detalhes);
        }

        return new ProjetoUpdateResult(ProjetoUpdateStatus.Updated, ToResponse(atualizado));
    }

    /// <summary>
    /// Exclui o documento (hard delete, preso a obra no SQL) e so depois, com o banco ja confirmado, apaga o arquivo do R2
    /// (falha no R2 vira contagem, nao 500). Auditoria <c>projeto_excluido</c> so com ids; se ela falhar, o arquivo ainda assim
    /// e removido do R2 e a excecao sobe. Devolve null se o documento nao existir nessa obra.
    /// </summary>
    public async Task<StorageCleanupResult?> DeleteAsync(Guid id, Guid obraId, Guid actorUserId)
    {
        var removido = await _repository.DeleteAsync(id, obraId);
        if (removido is null)
        {
            return null;
        }

        StorageCleanupResult limpeza;
        try
        {
            var detalhes = JsonSerializer.Serialize(new { obraId, etapaId = removido.EtapaId });
            await _auditoria.RegistrarAsync(actorUserId, "projeto_excluido", EntidadeAuditoria, id, detalhes);
        }
        finally
        {
            limpeza = await RemoverDoStorageAsync([removido.StorageKey]);
        }

        return limpeza;
    }

    /// <summary>
    /// Devolve null se o documento nao existir ou nao pertencer a obra informada (a mesma que foi autorizada).
    /// Content type derivado da extensao da CHAVE do R2 (imutavel; o upload valida extensao + MIME + magic bytes), nunca do
    /// nome editavel. Nome do download: o do documento, ou <c>projeto-{id}{ext}</c> se vier vazio, com caracteres de
    /// controle/separadores ou com extensao diferente da do arquivo.
    /// </summary>
    public async Task<(Stream Content, string FileName, string ContentType)?> DownloadAsync(Guid id, Guid obraId)
    {
        var documento = await _repository.GetByIdAndObraAsync(id, obraId);
        if (documento is null)
        {
            return null;
        }

        var extension = ProjetoRegras.ExtensaoSegura(documento.StorageKey);
        var nomeSeguro = ProjetoRegras.NomeArquivoValido(documento.Nome)
            && ProjetoRegras.ExtensaoSegura(documento.Nome) == extension;
        var fileName = nomeSeguro ? documento.Nome : $"projeto-{documento.Id}{extension}";

        var stream = await _storageService.DownloadAsync(documento.StorageKey);
        return (stream, fileName, ContentTypeFromExtension(extension));
    }

    public async Task<IReadOnlyList<ProjetoDocumentoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var documentos = await _repository.GetByObraIdAsync(obraId);
        return documentos.Select(ToResponse).ToList();
    }

    // Sem etapa informada = ok (o chamador ja filtrou); informada precisa ser desta obra (WHERE id AND obra_id).
    private async Task<bool> EtapaPertenceAObraAsync(Guid etapaId, Guid obraId) =>
        await _etapaRepository.GetByIdAndObraAsync(etapaId, obraId) is not null;

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

    private static ProjetoUploadResult Falha(ProjetoUploadStatus status) => new(status, null);

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
        // DWG: octet-stream (generico) e mais seguro que image/vnd.dwg, que alguns SOs/navegadores tentam abrir. Sempre download.
        ".dwg" => "application/octet-stream",
        _ => "application/octet-stream"
    };

    private static ProjetoDocumentoResponse ToResponse(ProjetoDocumento d) => new(
        d.Id, d.ObraId, d.EtapaId, d.Nome, d.TipoDocumento, d.UploadedAt);
}
