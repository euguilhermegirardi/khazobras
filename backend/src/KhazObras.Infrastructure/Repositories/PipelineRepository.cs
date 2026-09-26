using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class PipelineRepository : IPipelineRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public PipelineRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<Pipeline> CreateAsync(Pipeline pipeline)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO pipeline (id, nome_cliente_potencial, valor_estimado, probabilidade, etapa_funil, created_at, updated_at)
            VALUES (@Id, @NomeClientePotencial, @ValorEstimado, @Probabilidade, @EtapaFunil, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, pipeline);
        return pipeline;
    }

    public async Task<Pipeline?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, nome_cliente_potencial AS NomeClientePotencial, valor_estimado AS ValorEstimado,
                   probabilidade, etapa_funil AS EtapaFunil, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM pipeline
            WHERE id = @Id";

        return await connection.QuerySingleOrDefaultAsync<Pipeline>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<Pipeline>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, nome_cliente_potencial AS NomeClientePotencial, valor_estimado AS ValorEstimado,
                   probabilidade, etapa_funil AS EtapaFunil, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM pipeline
            ORDER BY created_at DESC";

        var rows = await connection.QueryAsync<Pipeline>(sql);
        return rows.ToList();
    }
}