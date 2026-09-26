using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class LogAuditoriaRepository : ILogAuditoriaRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public LogAuditoriaRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<LogAuditoria> CreateAsync(LogAuditoria log)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO log_auditoria (id, user_id, acao, entidade, entidade_id, detalhes, created_at)
            VALUES (@Id, @UserId, @Acao, @Entidade, @EntidadeId, @Detalhes::jsonb, @CreatedAt)";

        await connection.ExecuteAsync(sql, log);
        return log;
    }

    public async Task<IReadOnlyList<LogAuditoria>> GetByEntidadeAsync(string entidade, Guid entidadeId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, user_id AS UserId, acao, entidade, entidade_id AS EntidadeId,
                   detalhes::text AS Detalhes, created_at AS CreatedAt
            FROM log_auditoria
            WHERE entidade = @Entidade AND entidade_id = @EntidadeId
            ORDER BY created_at DESC";

        var rows = await connection.QueryAsync<LogAuditoria>(sql, new { Entidade = entidade, EntidadeId = entidadeId });
        return rows.ToList();
    }
}