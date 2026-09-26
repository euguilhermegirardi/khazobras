using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class EstoqueRepository : IEstoqueRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public EstoqueRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<EstoqueItem> CreateItemAsync(EstoqueItem item)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO estoque_itens (id, obra_id, nome, unidade, quantidade_atual, created_at, updated_at)
            VALUES (@Id, @ObraId, @Nome, @Unidade, @QuantidadeAtual, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, item);
        return item;
    }

    public async Task<EstoqueItem?> GetItemByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, unidade, quantidade_atual AS QuantidadeAtual,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM estoque_itens
            WHERE id = @Id";

        return await connection.QuerySingleOrDefaultAsync<EstoqueItem>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<EstoqueItem>> GetItensByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, unidade, quantidade_atual AS QuantidadeAtual,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM estoque_itens
            WHERE obra_id = @ObraId
            ORDER BY nome ASC";

        var rows = await connection.QueryAsync<EstoqueItem>(sql, new { ObraId = obraId });
        return rows.ToList();
    }

    public async Task<EstoqueMovimentacao> AddMovimentacaoAsync(EstoqueMovimentacao movimentacao)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO estoque_movimentacoes (id, item_id, tipo, quantidade, data, created_at)
            VALUES (@Id, @ItemId, @Tipo::estoque_movimentacao_tipo, @Quantidade, @Data, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            movimentacao.Id,
            movimentacao.ItemId,
            movimentacao.Tipo,
            movimentacao.Quantidade,
            Data = movimentacao.Data.ToDateTime(TimeOnly.MinValue),
            movimentacao.CreatedAt
        });

        return movimentacao;
    }

    public async Task UpdateQuantidadeAsync(Guid itemId, decimal novaQuantidade)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE estoque_itens
            SET quantidade_atual = @NovaQuantidade, updated_at = @UpdatedAt
            WHERE id = @ItemId";

        await connection.ExecuteAsync(sql, new { ItemId = itemId, NovaQuantidade = novaQuantidade, UpdatedAt = DateTime.UtcNow });
    }
}