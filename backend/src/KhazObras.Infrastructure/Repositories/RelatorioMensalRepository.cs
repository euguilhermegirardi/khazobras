using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class RelatorioMensalRepository : IRelatorioMensalRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RelatorioMensalRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<RelatorioMensal> CreateAsync(RelatorioMensal relatorio)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO relatorios_mensais (id, obra_id, competencia, conteudo, status, created_by_user_id, created_at, updated_at)
            VALUES (@Id, @ObraId, @Competencia, @Conteudo, @Status::relatorio_mensal_status, @CreatedByUserId, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            relatorio.Id,
            relatorio.ObraId,
            Competencia = relatorio.Competencia.ToDateTime(TimeOnly.MinValue),
            relatorio.Conteudo,
            relatorio.Status,
            relatorio.CreatedByUserId,
            relatorio.CreatedAt,
            relatorio.UpdatedAt
        });

        return relatorio;
    }

    public async Task<RelatorioMensal?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, competencia, conteudo, status,
                   published_at AS PublishedAt, created_by_user_id AS CreatedByUserId,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM relatorios_mensais
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioMensalRow>(sql, new { Id = id });
        return row?.ToEntity();
    }

    public async Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, competencia, conteudo, status,
                   published_at AS PublishedAt, created_by_user_id AS CreatedByUserId,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM relatorios_mensais
            WHERE obra_id = @ObraId
            ORDER BY competencia DESC";

        var rows = await connection.QueryAsync<RelatorioMensalRow>(sql, new { ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task PublishAsync(Guid id, DateTime publishedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE relatorios_mensais
            SET status = 'published'::relatorio_mensal_status, published_at = @PublishedAt, updated_at = @UpdatedAt
            WHERE id = @Id";

        await connection.ExecuteAsync(sql, new { Id = id, PublishedAt = publishedAt, UpdatedAt = DateTime.UtcNow });
    }

    private sealed class RelatorioMensalRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public DateTime Competencia { get; set; }
        public string Conteudo { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime? PublishedAt { get; set; }
        public Guid CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public RelatorioMensal ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Competencia = DateOnly.FromDateTime(Competencia),
            Conteudo = Conteudo,
            Status = Status,
            PublishedAt = PublishedAt,
            CreatedByUserId = CreatedByUserId,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }
}