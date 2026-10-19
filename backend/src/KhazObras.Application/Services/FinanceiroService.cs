using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Common;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public sealed class FinanceiroService
{
    private readonly IFinanceiroLancamentoRepository _lancamentoRepository;
    private readonly IStorageService _storageService;

    public FinanceiroService(IFinanceiroLancamentoRepository lancamentoRepository, IStorageService storageService)
    {
        _lancamentoRepository = lancamentoRepository;
        _storageService = storageService;
    }

    public async Task<FinanceiroLancamentoResponse> CreateAsync(CreateFinanceiroLancamentoRequest request, Guid createdByUserId)
    {
        var lancamento = new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Categoria = ParseCategoria(request.Categoria),
            Descricao = request.Descricao,
            Valor = request.Valor,
            DataLancamento = request.DataLancamento,
            MesCompetencia = request.MesCompetencia,
            CreatedByUserId = createdByUserId,
            VisivelCliente = request.VisivelCliente,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _lancamentoRepository.CreateAsync(lancamento);
        return ToResponse(created, []);
    }

    public async Task<FinanceiroLancamentoResponse?> GetByIdAsync(Guid id)
    {
        var lancamento = await _lancamentoRepository.GetByIdAsync(id);
        return lancamento is null ? null : ToResponse(lancamento, lancamento.Anexos);
    }

    public async Task<PagedResult<FinanceiroLancamentoResponse>> GetPagedByObraIdAsync(Guid obraId, int pageIndex, int pageSize)
    {
        var (items, totalItems) = await _lancamentoRepository.GetPagedByObraIdAsync(obraId, pageIndex, pageSize);
        var responses = items.Select(l => ToResponse(l, l.Anexos)).ToList();
        return new PagedResult<FinanceiroLancamentoResponse>(totalItems, pageIndex, pageSize, responses);
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

    public async Task<FinanceiroLancamentoResponse?> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente)
    {
        var atualizado = await _lancamentoRepository.SetVisibilidadeClienteAsync(id, obraId, visivelCliente);
        if (!atualizado)
        {
            return null;
        }

        return await GetByIdAndObraAsync(id, obraId);
    }

    /// <summary>Resolve so a obra do lancamento dono do anexo (query enxuta); o endpoint valida o acesso a ela antes do download.</summary>
    public Task<Guid?> ResolveAnexoAsync(Guid anexoId) => _lancamentoRepository.GetObraIdByAnexoIdAsync(anexoId);

    public async Task<FinanceiroAnexoResponse> UploadAnexoAsync(Guid lancamentoId, Stream content, string fileName, string contentType, long tamanhoBytes)
    {
        var lancamento = await _lancamentoRepository.GetByIdAsync(lancamentoId)
            ?? throw new InvalidOperationException("Lancamento nao encontrado.");

        // Chave nova: .../{guid}{ext}, sem o nome original (que segue em NomeArquivo). Chaves antigas {guid}-{nome} continuam legiveis.
        var storageKey = $"obras/{lancamento.ObraId}/financeiro/{lancamentoId}/{Guid.NewGuid()}{SafeExtension(fileName)}";
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

        var created = await _lancamentoRepository.AddAnexoAsync(anexo);
        return new FinanceiroAnexoResponse(created.Id, created.NomeArquivo, created.ContentType, created.TamanhoBytes, created.UploadedAt);
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

    private static string SafeExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension.Length is > 1 and <= 8 && extension.Skip(1).All(char.IsAsciiLetterOrDigit) ? extension : string.Empty;
    }

    private static ItemTipo ParseCategoria(string categoria) => categoria.ToLowerInvariant() switch
    {
        "mao_de_obra" => ItemTipo.MaoDeObra,
        "material" => ItemTipo.Material,
        "equipamento" => ItemTipo.Equipamento,
        _ => throw new ArgumentException($"Categoria invalida: {categoria}")
    };

    private static FinanceiroLancamentoResponse ToResponse(FinanceiroLancamento l, List<FinanceiroLancamentoAnexo> anexos) => new(
        l.Id, l.ObraId, l.Categoria.ToString(), l.Descricao, l.Valor, l.DataLancamento, l.MesCompetencia,
        l.CreatedByUserId, l.VisivelCliente, l.CreatedAt,
        anexos.Select(a => new FinanceiroAnexoResponse(a.Id, a.NomeArquivo, a.ContentType, a.TamanhoBytes, a.UploadedAt)).ToList());
}