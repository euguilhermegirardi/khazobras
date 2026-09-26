using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class FornecedorRepository : IFornecedorRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public FornecedorRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<Fornecedor> CreateAsync(Fornecedor fornecedor)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO fornecedores (id, nome, cnpj_cpf, contato, created_at, updated_at)
            VALUES (@Id, @Nome, @CnpjCpf, @Contato, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, fornecedor);
        return fornecedor;
    }

    public async Task<Fornecedor?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, nome, cnpj_cpf AS CnpjCpf, contato, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM fornecedores
            WHERE id = @Id";

        return await connection.QuerySingleOrDefaultAsync<Fornecedor>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<Fornecedor>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, nome, cnpj_cpf AS CnpjCpf, contato, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM fornecedores
            ORDER BY nome ASC";

        var rows = await connection.QueryAsync<Fornecedor>(sql);
        return rows.ToList();
    }
}