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
        l.CreatedByUserId, l.CreatedAt,
        anexos.Select(a => new FinanceiroAnexoResponse(a.Id, a.NomeArquivo, a.ContentType, a.TamanhoBytes, a.UploadedAt)).ToList());
}