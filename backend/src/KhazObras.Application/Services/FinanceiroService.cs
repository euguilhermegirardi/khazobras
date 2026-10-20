using System.Globalization;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Common;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public enum FinanceiroCreateStatus
{
    Created,
    ObraNaoEncontrada
}

public sealed record FinanceiroCreateResult(FinanceiroCreateStatus Status, FinanceiroLancamentoResponse? Lancamento);

public enum AnexoUploadStatus
{
    Created,
    LancamentoNaoEncontrado,
    LimiteExcedido
}

public sealed record AnexoUploadResult(AnexoUploadStatus Status, FinanceiroAnexoResponse? Anexo);

/// <summary>Resultado da limpeza no storage depois de apagar no banco (falha no R2 nao desfaz a exclusao).</summary>
public sealed record StorageCleanupResult(int ArquivosRemovidos, int FalhasNoStorage);

public sealed class FinanceiroService
{
    public const int MaxAnexosPorLancamento = 10;

    private const string EntidadeAuditoria = "financeiro_lancamento";

    private readonly IFinanceiroLancamentoRepository _lancamentoRepository;
    private readonly IStorageService _storageService;
    private readonly IObraRepository _obraRepository;
    private readonly LogAuditoriaService _auditoria;

    public FinanceiroService(
        IFinanceiroLancamentoRepository lancamentoRepository,
        IStorageService storageService,
        IObraRepository obraRepository,
        LogAuditoriaService auditoria)
    {
        _lancamentoRepository = lancamentoRepository;
        _storageService = storageService;
        _obraRepository = obraRepository;
        _auditoria = auditoria;
    }

    /// <summary>Cria o lancamento (oculto para o cliente por padrao). O endpoint ja validou acesso a obra e o corpo.</summary>
    public async Task<FinanceiroCreateResult> CreateAsync(CreateFinanceiroLancamentoRequest request, Guid createdByUserId)
    {
        if (await _obraRepository.GetByIdAsync(request.ObraId) is null)
        {
            return new FinanceiroCreateResult(FinanceiroCreateStatus.ObraNaoEncontrada, null);
        }

        var lancamento = new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Categoria = ParseCategoria(request.Categoria),
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataLancamento = request.DataLancamento,
            MesCompetencia = request.MesCompetencia,
            CreatedByUserId = createdByUserId,
            VisivelCliente = request.VisivelCliente,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _lancamentoRepository.CreateAsync(lancamento);
        return new FinanceiroCreateResult(FinanceiroCreateStatus.Created, ToResponse(created, []));
    }

    public async Task<FinanceiroLancamentoResponse?> GetByIdAsync(Guid id)
    {
        var lancamento = await _lancamentoRepository.GetByIdAsync(id);
        return lancamento is null ? null : ToResponse(lancamento, lancamento.Anexos);
    }

    /// <summary>Lista ADMIN (todos os lancamentos, liberados ou nao), com filtros opcionais aplicados no SQL.</summary>
    public async Task<PagedResult<FinanceiroLancamentoResponse>> GetPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, FinanceiroFiltro? filtro = null)
    {
        var (items, totalItems) = await _lancamentoRepository.GetPagedByObraIdAsync(obraId, pageIndex, pageSize, somenteVisiveisCliente: false, filtro);
        var responses = items.Select(l => ToResponse(l, l.Anexos)).ToList();
        return new PagedResult<FinanceiroLancamentoResponse>(totalItems, pageIndex, pageSize, responses);
    }

    /// <summary>
    /// Interpreta os filtros da query string da lista admin. Devolve false (com a mensagem do 400) se algum valor
    /// for invalido; filtro vazio/ausente = sem filtro.
    /// </summary>
    public static bool TryParseFiltro(string? visivelCliente, string? categoria, string? competencia, out FinanceiroFiltro filtro, out string? erro)
    {
        filtro = new FinanceiroFiltro();
        erro = null;

        bool? visivel = null;
        if (!string.IsNullOrWhiteSpace(visivelCliente))
        {
            if (!bool.TryParse(visivelCliente.Trim(), out var parsed))
            {
                erro = "visivelCliente deve ser true ou false.";
                return false;
            }

            visivel = parsed;
        }

        ItemTipo? tipo = null;
        if (!string.IsNullOrWhiteSpace(categoria))
        {
            if (!FinanceiroCategorias.TryParse(categoria, out var parsed))
            {
                erro = "categoria deve ser mao_de_obra, material ou equipamento.";
                return false;
            }

            tipo = parsed;
        }

        DateOnly? mes = null;
        if (!string.IsNullOrWhiteSpace(competencia))
        {
            if (!DateOnly.TryParseExact(competencia.Trim() + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
                || parsed.Year is < 2000 or > 2100)
            {
                erro = "competencia deve estar no formato yyyy-MM (ex.: 2026-10).";
                return false;
            }

            mes = parsed;
        }

        filtro = new FinanceiroFiltro(visivel, tipo, mes);
        return true;
    }

    /// <summary>Agregado ADMIN (custo real). Nunca chamar para o cliente.</summary>
    public async Task<FinanceiroResumoResponse> GetResumoAsync(Guid obraId)
    {
        var r = await _lancamentoRepository.GetResumoByObraIdAsync(obraId);
        return new FinanceiroResumoResponse(
            r.TotalLancado, r.TotalLiberadoCliente, r.TotalNaoLiberado,
            r.QuantidadeLancamentos, r.QuantidadeLiberada, r.QuantidadeNaoLiberada);
    }

    /// <summary>
    /// Visao do CLIENTE a partir da visao completa. Devolve null se o admin nao liberou
    /// o lancamento (o endpoint responde 404, sem revelar que o registro existe).
    /// </summary>
    public FinanceiroLancamentoClienteResponse? ToClienteView(FinanceiroLancamentoResponse lancamento) =>
        lancamento.VisivelCliente
            ? new FinanceiroLancamentoClienteResponse(
                lancamento.Id, lancamento.ObraId, lancamento.Categoria, lancamento.Descricao, lancamento.Valor,
                lancamento.DataLancamento, lancamento.MesCompetencia, lancamento.Anexos)
            : null;

    /// <summary>Lista para o CLIENTE: o filtro por visibilidade e aplicado no SQL (contagem e itens).</summary>
    public async Task<PagedResult<FinanceiroLancamentoClienteResponse>> GetPagedParaClienteByObraIdAsync(Guid obraId, int pageIndex, int pageSize)
    {
        var (items, totalItems) = await _lancamentoRepository.GetPagedByObraIdAsync(obraId, pageIndex, pageSize, somenteVisiveisCliente: true);
        var responses = items
            .Select(l => ToClienteView(ToResponse(l, l.Anexos)))
            .OfType<FinanceiroLancamentoClienteResponse>()
            .ToList();
        return new PagedResult<FinanceiroLancamentoClienteResponse>(totalItems, pageIndex, pageSize, responses);
    }

    /// <summary>Resolve so a obra do lancamento (query enxuta); o endpoint valida o acesso a ela antes de ler/alterar.</summary>
    public Task<Guid?> ResolveLancamentoAsync(Guid id) => _lancamentoRepository.GetObraIdByIdAsync(id);

    /// <summary>Visao completa (Admin/Master) numa consulta unica por id + obra.</summary>
    public async Task<FinanceiroLancamentoResponse?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var lancamento = await _lancamentoRepository.GetByIdAndObraAsync(id, obraId, somenteVisiveisCliente: false);
        return lancamento is null ? null : ToResponse(lancamento, lancamento.Anexos);
    }

    /// <summary>Visao do CLIENTE: id + obra + visibilidade filtrados no SQL; oculto ou de outra obra = null (404).</summary>
    public async Task<FinanceiroLancamentoClienteResponse?> GetParaClienteByIdAndObraAsync(Guid id, Guid obraId)
    {
        var lancamento = await _lancamentoRepository.GetByIdAndObraAsync(id, obraId, somenteVisiveisCliente: true);
        return lancamento is null ? null : ToClienteView(ToResponse(lancamento, lancamento.Anexos));
    }

    /// <summary>
    /// Edita os campos do lancamento (a obra nunca muda). Auditoria <c>lancamento_editado</c> so com ids e NOMES dos
    /// campos alterados (sem valores nem descricao). Devolve null se o lancamento nao existir nessa obra.
    /// </summary>
    public async Task<FinanceiroLancamentoResponse?> UpdateAsync(Guid id, Guid obraId, UpdateFinanceiroLancamentoRequest request, Guid actorUserId)
    {
        var atual = await _lancamentoRepository.GetByIdAndObraAsync(id, obraId, somenteVisiveisCliente: false);
        if (atual is null)
        {
            return null;
        }

        var novo = new FinanceiroLancamento
        {
            Id = atual.Id,
            ObraId = atual.ObraId,
            Categoria = ParseCategoria(request.Categoria),
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataLancamento = request.DataLancamento,
            MesCompetencia = request.MesCompetencia,
            CreatedByUserId = atual.CreatedByUserId,
            VisivelCliente = request.VisivelCliente ?? atual.VisivelCliente,
            CreatedAt = atual.CreatedAt
        };

        var campos = new List<string>();
        if (novo.Categoria != atual.Categoria) campos.Add("categoria");
        if (!string.Equals(novo.Descricao, atual.Descricao, StringComparison.Ordinal)) campos.Add("descricao");
        if (novo.Valor != atual.Valor) campos.Add("valor");
        if (novo.DataLancamento != atual.DataLancamento) campos.Add("dataLancamento");
        if (novo.MesCompetencia != atual.MesCompetencia) campos.Add("mesCompetencia");
        if (novo.VisivelCliente != atual.VisivelCliente) campos.Add("visivelCliente");

        if (!await _lancamentoRepository.UpdateAsync(novo))
        {
            return null;
        }

        if (campos.Count > 0)
        {
            var detalhes = JsonSerializer.Serialize(new { obraId, campos });
            await _auditoria.RegistrarAsync(actorUserId, "lancamento_editado", EntidadeAuditoria, id, detalhes);
        }

        return ToResponse(novo, atual.Anexos);
    }

    /// <summary>
    /// Exclui o lancamento (hard delete; anexos saem por CASCADE e os arquivos do R2 sao apagados em seguida).
    /// Auditoria <c>lancamento_excluido</c> so com ids e quantidade de anexos. Devolve null se nao existir nessa obra.
    /// </summary>
    public async Task<StorageCleanupResult?> DeleteAsync(Guid id, Guid obraId, Guid actorUserId)
    {
        var chaves = await _lancamentoRepository.DeleteAsync(id, obraId);
        if (chaves is null)
        {
            return null;
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, quantidadeAnexos = chaves.Count });
        await _auditoria.RegistrarAsync(actorUserId, "lancamento_excluido", EntidadeAuditoria, id, detalhes);

        return await RemoverDoStorageAsync(chaves);
    }

    public async Task<FinanceiroLancamentoResponse?> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente, Guid? actorUserId = null)
    {
        var antes = await _lancamentoRepository.GetByIdAndObraAsync(id, obraId, somenteVisiveisCliente: false);
        if (antes is null)
        {
            return null;
        }

        if (!await _lancamentoRepository.SetVisibilidadeClienteAsync(id, obraId, visivelCliente))
        {
            return null;
        }

        if (antes.VisivelCliente != visivelCliente)
        {
            await RegistrarVisibilidadeAsync(actorUserId, id, obraId, antes.VisivelCliente, visivelCliente, lote: false);
        }

        return await GetByIdAndObraAsync(id, obraId);
    }

    /// <summary>
    /// Libera/oculta varios lancamentos de uma vez (tudo-ou-nada). Devolve null se algum id nao for desta obra
    /// (inexistente e de outra obra sao indistinguiveis); nesse caso nada e alterado. Ids repetidos contam uma vez.
    /// </summary>
    public async Task<FinanceiroVisibilidadeLoteResponse?> SetVisibilidadeLoteAsync(Guid obraId, IEnumerable<Guid> ids, bool visivelCliente, Guid actorUserId)
    {
        var distintos = ids.Distinct().ToList();
        var anteriores = await _lancamentoRepository.SetVisibilidadeLoteAsync(obraId, distintos, visivelCliente);
        if (anteriores is null)
        {
            return null;
        }

        foreach (var (id, anterior) in anteriores.Where(a => a.VisivelAnterior != visivelCliente))
        {
            await RegistrarVisibilidadeAsync(actorUserId, id, obraId, anterior, visivelCliente, lote: true);
        }

        return new FinanceiroVisibilidadeLoteResponse(anteriores.Count, visivelCliente);
    }

    private Task RegistrarVisibilidadeAsync(Guid? actorUserId, Guid id, Guid obraId, bool anterior, bool novo, bool lote)
    {
        var detalhes = JsonSerializer.Serialize(new
        {
            obraId,
            statusAnterior = anterior ? "liberado" : "oculto",
            statusNovo = novo ? "liberado" : "oculto",
            lote
        });

        return _auditoria.RegistrarAsync(actorUserId, "lancamento_visibilidade_alterada", EntidadeAuditoria, id, detalhes);
    }

    /// <summary>Resolve so a obra do lancamento dono do anexo (query enxuta); o endpoint valida o acesso a ela antes do download/exclusao.</summary>
    public Task<Guid?> ResolveAnexoAsync(Guid anexoId) => _lancamentoRepository.GetObraIdByAnexoIdAsync(anexoId);

    /// <summary>
    /// Sobe o arquivo para o R2 e registra o anexo. O lancamento precisa ser da obra informada (a que foi autorizada)
    /// e ter menos de <see cref="MaxAnexosPorLancamento"/> anexos; o INSERT tambem confere o limite (corrida).
    /// </summary>
    public async Task<AnexoUploadResult> UploadAnexoAsync(Guid lancamentoId, Guid obraId, Stream content, string fileName, string contentType, long tamanhoBytes)
    {
        var lancamento = await _lancamentoRepository.GetByIdAndObraAsync(lancamentoId, obraId, somenteVisiveisCliente: false);
        if (lancamento is null)
        {
            return new AnexoUploadResult(AnexoUploadStatus.LancamentoNaoEncontrado, null);
        }

        if (lancamento.Anexos.Count >= MaxAnexosPorLancamento)
        {
            return new AnexoUploadResult(AnexoUploadStatus.LimiteExcedido, null);
        }

        // Chave nova: .../{guid}{ext}, sem o nome original (que segue em NomeArquivo). Chaves antigas {guid}-{nome} continuam legiveis.
        var storageKey = $"obras/{obraId}/financeiro/{lancamentoId}/{Guid.NewGuid()}{SafeExtension(fileName)}";
        await _storageService.UploadAsync(storageKey, content, contentType);

        var anexo = new FinanceiroLancamentoAnexo
        {
            Id = Guid.NewGuid(),
            LancamentoId = lancamentoId,
            NomeArquivo = fileName,
            StorageKey = storageKey,
            ContentType = contentType,
            TamanhoBytes = tamanhoBytes,
            UploadedAt = DateTime.UtcNow
        };

        if (!await _lancamentoRepository.TryAddAnexoAsync(anexo, obraId, MaxAnexosPorLancamento))
        {
            // Outro upload ocupou a ultima vaga entre a checagem e o INSERT: nao deixa arquivo orfao no R2.
            await RemoverDoStorageAsync([storageKey]);
            return new AnexoUploadResult(AnexoUploadStatus.LimiteExcedido, null);
        }

        return new AnexoUploadResult(
            AnexoUploadStatus.Created,
            new FinanceiroAnexoResponse(anexo.Id, anexo.NomeArquivo, anexo.ContentType, anexo.TamanhoBytes, anexo.UploadedAt));
    }

    /// <summary>
    /// Remove o anexo (preso a obra no SQL) e depois o arquivo do R2. Auditoria <c>lancamento_anexo_removido</c> com ids.
    /// Devolve null se o anexo nao existir nessa obra.
    /// </summary>
    public async Task<StorageCleanupResult?> DeleteAnexoAsync(Guid anexoId, Guid obraId, Guid actorUserId)
    {
        var anexo = await _lancamentoRepository.DeleteAnexoAsync(anexoId, obraId);
        if (anexo is null)
        {
            return null;
        }

        var detalhes = JsonSerializer.Serialize(new { obraId, anexoId });
        await _auditoria.RegistrarAsync(actorUserId, "lancamento_anexo_removido", EntidadeAuditoria, anexo.LancamentoId, detalhes);

        return await RemoverDoStorageAsync([anexo.StorageKey]);
    }

    /// <summary>
    /// Devolve null se o anexo nao existir, nao pertencer a obra informada (a mesma que foi autorizada) ou, para o
    /// cliente (<paramref name="somenteVisiveisCliente"/>), se o lancamento nao estiver liberado. Tudo filtrado no SQL.
    /// </summary>
    public async Task<(Stream Content, string FileName, string? ContentType)?> DownloadAnexoAsync(Guid anexoId, Guid obraId, bool somenteVisiveisCliente)
    {
        var anexo = await _lancamentoRepository.GetAnexoByIdAndObraAsync(anexoId, obraId, somenteVisiveisCliente);
        if (anexo is null)
        {
            return null;
        }

        var stream = await _storageService.DownloadAsync(anexo.StorageKey);
        return (stream, anexo.NomeArquivo, anexo.ContentType);
    }

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

    private static string SafeExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension.Length is > 1 and <= 8 && extension.Skip(1).All(char.IsAsciiLetterOrDigit) ? extension : string.Empty;
    }

    private static ItemTipo ParseCategoria(string categoria) =>
        FinanceiroCategorias.TryParse(categoria, out var tipo)
            ? tipo
            : throw new ArgumentException($"Categoria invalida: {categoria}");

    private static FinanceiroLancamentoResponse ToResponse(FinanceiroLancamento l, List<FinanceiroLancamentoAnexo> anexos) => new(
        l.Id, l.ObraId, l.Categoria.ToString(), l.Descricao, l.Valor, l.DataLancamento, l.MesCompetencia,
        l.CreatedByUserId, l.VisivelCliente, l.CreatedAt,
        anexos.Select(a => new FinanceiroAnexoResponse(a.Id, a.NomeArquivo, a.ContentType, a.TamanhoBytes, a.UploadedAt)).ToList());
}
