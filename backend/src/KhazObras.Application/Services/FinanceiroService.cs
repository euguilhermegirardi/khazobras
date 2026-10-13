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

    public async Task<FinanceiroLancamentoResponse?> SetVisibilidadeClienteAsync(Guid id, bool visivelCliente)
    {
        var lancamento = await _lancamentoRepository.GetByIdAsync(id);
        if (lancamento is null)
        {
            return null;
        }

        await _lancamentoRepository.SetVisibilidadeClienteAsync(id, visivelCliente);
        lancamento.VisivelCliente = visivelCliente;
        return ToResponse(lancamento, lancamento.Anexos);
    }

    /// <summary>Resolve a obra e a visibilidade do lancamento dono do anexo, para o controle de acesso no endpoint.</summary>
    public async Task<(Guid ObraId, bool VisivelCliente)?> ResolveAnexoAsync(Guid anexoId)
    {
        var anexo = await _lancamentoRepository.GetAnexoByIdAsync(anexoId);
        if (anexo is null)
        {
            return null;
        }

        var lancamento = await _lancamentoRepository.GetByIdAsync(anexo.LancamentoId);
        return lancamento is null ? null : (lancamento.ObraId, lancamento.VisivelCliente);
    }

    public async Task<FinanceiroAnexoResponse> UploadAnexoAsync(Guid lancamentoId, Stream content, string fileName, string contentType, long tamanhoBytes)
    {
        var lancamento = await _lancamentoRepository.GetByIdAsync(lancamentoId)
            ?? throw new InvalidOperationException("Lancamento nao encontrado.");

        var storageKey = $"obras/{lancamento.ObraId}/financeiro/{lancamentoId}/{Guid.NewGuid()}-{fileName}";
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

    public async Task<(Stream Content, string FileName, string? ContentType)?> DownloadAnexoAsync(Guid anexoId)
    {
        var anexo = await _lancamentoRepository.GetAnexoByIdAsync(anexoId);
        if (anexo is null)
        {
            return null;
        }

        var stream = await _storageService.DownloadAsync(anexo.StorageKey);
        return (stream, anexo.NomeArquivo, anexo.ContentType);
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