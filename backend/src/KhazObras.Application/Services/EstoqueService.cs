using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Estoque;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class EstoqueService
{
    private readonly IEstoqueRepository _repository;

    public EstoqueService(IEstoqueRepository repository) => _repository = repository;

    public async Task<EstoqueItemResponse> CreateItemAsync(CreateEstoqueItemRequest request)
    {
        var item = new EstoqueItem
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Nome = request.Nome,
            Unidade = request.Unidade,
            QuantidadeAtual = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateItemAsync(item);
        return ToResponse(created);
    }

    public async Task<IReadOnlyList<EstoqueItemResponse>> GetItensByObraIdAsync(Guid obraId)
    {
        var itens = await _repository.GetItensByObraIdAsync(obraId);
        return itens.Select(ToResponse).ToList();
    }

    public async Task<EstoqueItemResponse> AddMovimentacaoAsync(Guid itemId, CreateMovimentacaoRequest request)
    {
        var item = await _repository.GetItemByIdAsync(itemId)
            ?? throw new InvalidOperationException("Item de estoque nao encontrado.");

        var tipo = request.Tipo.ToLowerInvariant();
        if (tipo != "entrada" && tipo != "saida")
        {
            throw new ArgumentException("Tipo deve ser entrada ou saida.");
        }

        await _repository.AddMovimentacaoAsync(new EstoqueMovimentacao
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            Tipo = tipo,
            Quantidade = request.Quantidade,
            Data = request.Data,
            CreatedAt = DateTime.UtcNow
        });

        var novaQuantidade = tipo == "entrada"
            ? item.QuantidadeAtual + request.Quantidade
            : item.QuantidadeAtual - request.Quantidade;

        await _repository.UpdateQuantidadeAsync(itemId, novaQuantidade);

        var updated = await _repository.GetItemByIdAsync(itemId);
        return ToResponse(updated!);
    }

    private static EstoqueItemResponse ToResponse(EstoqueItem i) => new(i.Id, i.ObraId, i.Nome, i.Unidade, i.QuantidadeAtual, i.CreatedAt);
}