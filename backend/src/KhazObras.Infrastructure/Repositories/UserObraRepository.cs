using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class UserObraRepository : IUserObraRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public UserObraRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task LinkAsync(Guid userId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO user_obra (user_id, obra_id, created_at)
            VALUES (@UserId, @ObraId, @CreatedAt)
            ON CONFLICT (user_id, obra_id) DO NOTHING";

        await connection.ExecuteAsync(sql, new { UserId = userId, ObraId = obraId, CreatedAt = DateTime.UtcNow });
    }

    public async Task<bool> HasAccessAsync(Guid userId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT COUNT(1) FROM user_obra WHERE user_id = @UserId AND obra_id = @ObraId";
        var count = await connection.ExecuteScalarAsync<int>(sql, new { UserId = userId, ObraId = obraId });
        return count > 0;
    }

    public async Task<IReadOnlyList<Guid>> GetObraIdsForUserAsync(Guid userId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM user_obra WHERE user_id = @UserId";
        var rows = await connection.QueryAsync<Guid>(sql, new { UserId = userId });
        return rows.ToList();
    }
}