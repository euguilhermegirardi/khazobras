using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IEstoqueRepository
{
    Task<EstoqueItem> CreateItemAsync(EstoqueItem item);
    Task<EstoqueItem?> GetItemByIdAsync(Guid id);
    Task<IReadOnlyList<EstoqueItem>> GetItensByObraIdAsync(Guid obraId);
    Task<EstoqueMovimentacao> AddMovimentacaoAsync(EstoqueMovimentacao movimentacao);
    Task UpdateQuantidadeAsync(Guid itemId, decimal novaQuantidade);
}