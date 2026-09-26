using System.Text.Json;
using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class NotificacaoRepository : INotificacaoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public NotificacaoRepository(IDbConnectionFactory connectionFactory) => _connectionFactory = connectionFactory;

    public async Task<Notificacao> CreateAsync(Notificacao notificacao)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO notificacoes (id, obra_id, user_id, modulos, canal, enviado_at)
            VALUES (@Id, @ObraId, @UserId, @Modulos::jsonb, @Canal, @EnviadoAt)";

        await connection.ExecuteAsync(sql, new
        {
            notificacao.Id,
            notificacao.ObraId,
            notificacao.UserId,
            Modulos = JsonSerializer.Serialize(notificacao.Modulos),
            notificacao.Canal,
            notificacao.EnviadoAt
        });

        return notificacao;
    }

    public async Task<IReadOnlyList<Notificacao>> GetByUserIdAsync(Guid userId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, user_id AS UserId, modulos::text AS ModulosJson,
                   canal, enviado_at AS EnviadoAt, lida_at AS LidaAt
            FROM notificacoes
            WHERE user_id = @UserId
            ORDER BY enviado_at DESC";

        var rows = await connection.QueryAsync<NotificacaoRow>(sql, new { UserId = userId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task MarkAsReadAsync(Guid id, DateTime lidaAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "UPDATE notificacoes SET lida_at = @LidaAt WHERE id = @Id";
        await connection.ExecuteAsync(sql, new { Id = id, LidaAt = lidaAt });
    }

    private sealed class NotificacaoRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public Guid UserId { get; set; }
        public string ModulosJson { get; set; } = "[]";
        public string Canal { get; set; } = string.Empty;
        public DateTime EnviadoAt { get; set; }
        public DateTime? LidaAt { get; set; }

        public Notificacao ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            UserId = UserId,
            Modulos = JsonSerializer.Deserialize<List<string>>(ModulosJson) ?? [],
            Canal = Canal,
            EnviadoAt = EnviadoAt,
            LidaAt = LidaAt
        };
    }
}