using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class PrestadorRepository : IPrestadorRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public PrestadorRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<Prestador> CreateAsync(Prestador prestador)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO prestadores (id, obra_id, nome, funcao, valor_contrato, created_at, updated_at)
            VALUES (@Id, @ObraId, @Nome, @Funcao, @ValorContrato, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, prestador);
        return prestador;
    }

    public async Task<Prestador?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, funcao, valor_contrato AS ValorContrato,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM prestadores
            WHERE id = @Id";

        return await connection.QuerySingleOrDefaultAsync<Prestador>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<Prestador>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, funcao, valor_contrato AS ValorContrato,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM prestadores
            WHERE obra_id = @ObraId
            ORDER BY nome ASC";

        var rows = await connection.QueryAsync<Prestador>(sql, new { ObraId = obraId });
        return rows.ToList();
    }
}