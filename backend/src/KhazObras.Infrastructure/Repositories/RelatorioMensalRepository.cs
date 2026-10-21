using System.Data;
using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;
using Npgsql;

namespace KhazObras.Infrastructure.Repositories;

public sealed class RelatorioMensalRepository : IRelatorioMensalRepository
{
    // Mesmas colunas em todo SELECT/RETURNING (alias no formato da RelatorioMensalRow).
    private const string Colunas = @"
        id, obra_id AS ObraId, competencia, conteudo, status::text AS Status,
        published_at AS PublishedAt, created_by_user_id AS CreatedByUserId,
        created_at AS CreatedAt, updated_at AS UpdatedAt";

    private readonly IDbConnectionFactory _connectionFactory;

    public RelatorioMensalRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<RelatorioMensalWriteResult> TryCreateAsync(RelatorioMensal relatorio)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Um unico comando: so insere se a obra existe (INSERT ... SELECT FROM obras) e, pelo ON CONFLICT, so se o mes ainda
        // nao tem relatorio. Sem linha de volta = obra inexistente ou competencia duplicada (a consulta abaixo diz qual).
        const string sql = @"
            INSERT INTO relatorios_mensais (id, obra_id, competencia, conteudo, status, created_by_user_id, created_at, updated_at)
            SELECT @Id, o.id, @Competencia::date, @Conteudo, 'draft'::relatorio_mensal_status, @CreatedByUserId, @CreatedAt, @UpdatedAt
            FROM obras o
            WHERE o.id = @ObraId
            ON CONFLICT (obra_id, competencia) DO NOTHING
            RETURNING id";

        var inserido = await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new
        {
            relatorio.Id,
            relatorio.ObraId,
            Competencia = relatorio.Competencia.ToDateTime(TimeOnly.MinValue),
            relatorio.Conteudo,
            relatorio.CreatedByUserId,
            relatorio.CreatedAt,
            relatorio.UpdatedAt
        });

        if (inserido is not null)
        {
            return new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, relatorio);
        }

        const string obraSql = "SELECT EXISTS (SELECT 1 FROM obras WHERE id = @ObraId)";
        var obraExiste = await connection.QuerySingleAsync<bool>(obraSql, new { relatorio.ObraId });
        return new RelatorioMensalWriteResult(
            obraExiste ? RelatorioMensalWriteStatus.CompetenciaDuplicada : RelatorioMensalWriteStatus.ObraNaoEncontrada, null);
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM relatorios_mensais WHERE id = @Id";
        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<RelatorioMensal?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT " + Colunas + @"
            FROM relatorios_mensais
            WHERE id = @Id AND obra_id = @ObraId";

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioMensalRow>(sql, new { Id = id, ObraId = obraId });
        return row?.ToEntity();
    }

    public async Task<RelatorioMensal?> GetPublishedByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT " + Colunas + @"
            FROM relatorios_mensais
            WHERE id = @Id AND obra_id = @ObraId AND status = 'published'::relatorio_mensal_status";

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioMensalRow>(sql, new { Id = id, ObraId = obraId });
        return row?.ToEntity();
    }

    public async Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        // No maximo um por mes (UNIQUE obra_id + competencia): a lista e limitada, por isso sem paginacao.
        const string sql = "SELECT " + Colunas + @"
            FROM relatorios_mensais
            WHERE obra_id = @ObraId
            ORDER BY competencia DESC, id ASC";

        var rows = await connection.QueryAsync<RelatorioMensalRow>(sql, new { ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task<IReadOnlyList<RelatorioMensal>> GetPublishedByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT " + Colunas + @"
            FROM relatorios_mensais
            WHERE obra_id = @ObraId AND status = 'published'::relatorio_mensal_status
            ORDER BY competencia DESC, id ASC";

        var rows = await connection.QueryAsync<RelatorioMensalRow>(sql, new { ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task<RelatorioMensalWriteResult> UpdateDraftAsync(
        Guid id, Guid obraId, DateOnly competencia, string conteudo, DateTime updatedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Atomico: so altera se ainda for rascunho (uma publicacao simultanea vence e este UPDATE nao acha a linha).
        const string sql = @"
            UPDATE relatorios_mensais
            SET competencia = @Competencia::date, conteudo = @Conteudo, updated_at = @UpdatedAt
            WHERE id = @Id AND obra_id = @ObraId AND status = 'draft'::relatorio_mensal_status
            RETURNING " + Colunas;

        try
        {
            var row = await connection.QuerySingleOrDefaultAsync<RelatorioMensalRow>(sql, new
            {
                Id = id,
                ObraId = obraId,
                Competencia = competencia.ToDateTime(TimeOnly.MinValue),
                Conteudo = conteudo,
                UpdatedAt = updatedAt
            });

            return row is not null
                ? new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, row.ToEntity())
                : new RelatorioMensalWriteResult(await MotivoDaFalhaAsync(connection, id, obraId), null);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            // UNIQUE (obra_id, competencia): o mes novo ja tem relatorio.
            return new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.CompetenciaDuplicada, null);
        }
    }

    public async Task<RelatorioMensalWriteResult> PublishAsync(Guid id, Guid obraId, DateTime publishedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE relatorios_mensais
            SET status = 'published'::relatorio_mensal_status, published_at = @PublishedAt, updated_at = @PublishedAt
            WHERE id = @Id AND obra_id = @ObraId AND status = 'draft'::relatorio_mensal_status
            RETURNING " + Colunas;

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioMensalRow>(
            sql, new { Id = id, ObraId = obraId, PublishedAt = publishedAt });

        return row is not null
            ? new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, row.ToEntity())
            : new RelatorioMensalWriteResult(await MotivoDaFalhaAsync(connection, id, obraId), null);
    }

    public async Task<RelatorioMensalWriteStatus> DeleteDraftAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            DELETE FROM relatorios_mensais
            WHERE id = @Id AND obra_id = @ObraId AND status = 'draft'::relatorio_mensal_status
            RETURNING id";

        var removido = await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { Id = id, ObraId = obraId });
        return removido is not null
            ? RelatorioMensalWriteStatus.Ok
            : await MotivoDaFalhaAsync(connection, id, obraId);
    }

    // Escrita condicionada a rascunho que nao achou linha: o relatorio nao existe nesta obra, ou existe e ja foi publicado.
    private static async Task<RelatorioMensalWriteStatus> MotivoDaFalhaAsync(IDbConnection connection, Guid id, Guid obraId)
    {
        const string sql = "SELECT status::text FROM relatorios_mensais WHERE id = @Id AND obra_id = @ObraId";
        var status = await connection.QuerySingleOrDefaultAsync<string>(sql, new { Id = id, ObraId = obraId });
        return status is null ? RelatorioMensalWriteStatus.NaoEncontrado : RelatorioMensalWriteStatus.Conflito;
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
