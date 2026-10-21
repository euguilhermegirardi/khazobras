using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class ProjetoDocumentoRepository : IProjetoDocumentoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ProjetoDocumentoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<int?> CountByObraAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT (SELECT COUNT(*) FROM projetos_documentos d WHERE d.obra_id = o.id)::int
            FROM obras o
            WHERE o.id = @ObraId";

        return await connection.QuerySingleOrDefaultAsync<int?>(sql, new { ObraId = obraId });
    }

    public async Task<ProjetoInsertResult> TryAddAsync(ProjetoDocumento documento, int maxDocumentos)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            // Trava a linha da obra (a "pai" da contagem): outro upload da mesma obra espera o commit, entao o COUNT abaixo e
            // confiavel. FOR NO KEY UPDATE (e nao FOR UPDATE) porque nao conflita com o FOR KEY SHARE que o INSERT de etapas,
            // medicoes etc. toma na mesma linha por causa da FK; so os uploads de projeto se enfileiram entre si.
            const string lockSql = "SELECT id FROM obras WHERE id = @ObraId FOR NO KEY UPDATE";
            var travada = await connection.QuerySingleOrDefaultAsync<Guid?>(lockSql, new { ObraId = documento.ObraId }, transaction);
            if (travada is null)
            {
                transaction.Rollback();
                return ProjetoInsertResult.ObraNaoEncontrada;
            }

            const string countSql = "SELECT COUNT(*)::int FROM projetos_documentos WHERE obra_id = @ObraId";
            var total = await connection.QuerySingleAsync<int>(countSql, new { ObraId = documento.ObraId }, transaction);
            if (total >= maxDocumentos)
            {
                transaction.Rollback();
                return ProjetoInsertResult.LimiteExcedido;
            }

            const string insertSql = @"
                INSERT INTO projetos_documentos (id, obra_id, etapa_id, nome, storage_key, tipo_documento, uploaded_at)
                VALUES (@Id, @ObraId, @EtapaId, @Nome, @StorageKey, @TipoDocumento, @UploadedAt)";
            await connection.ExecuteAsync(insertSql, documento, transaction);

            transaction.Commit();
            return ProjetoInsertResult.Added;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM projetos_documentos WHERE id = @Id";
        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<ProjetoDocumento?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, etapa_id AS EtapaId, nome, storage_key AS StorageKey,
                   tipo_documento AS TipoDocumento, uploaded_at AS UploadedAt
            FROM projetos_documentos
            WHERE id = @Id AND obra_id = @ObraId";

        return await connection.QuerySingleOrDefaultAsync<ProjetoDocumento>(sql, new { Id = id, ObraId = obraId });
    }

    public async Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Ordem estavel: etapa (sem etapa por ultimo), envio mais novo primeiro, nome, id.
        const string sql = @"
            SELECT d.id, d.obra_id AS ObraId, d.etapa_id AS EtapaId, d.nome, d.storage_key AS StorageKey,
                   d.tipo_documento AS TipoDocumento, d.uploaded_at AS UploadedAt
            FROM projetos_documentos d
            LEFT JOIN etapas e ON e.id = d.etapa_id AND e.obra_id = d.obra_id
            WHERE d.obra_id = @ObraId
            ORDER BY e.ordem ASC NULLS LAST, d.uploaded_at DESC, d.nome ASC, d.id ASC";

        var rows = await connection.QueryAsync<ProjetoDocumento>(sql, new { ObraId = obraId });
        return rows.ToList();
    }

    public async Task<ProjetoDocumento?> UpdateAsync(Guid id, Guid obraId, string nome, string? tipoDocumento, Guid? etapaId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE projetos_documentos
            SET nome = @Nome, tipo_documento = @TipoDocumento, etapa_id = @EtapaId
            WHERE id = @Id AND obra_id = @ObraId
            RETURNING id, obra_id AS ObraId, etapa_id AS EtapaId, nome, storage_key AS StorageKey,
                      tipo_documento AS TipoDocumento, uploaded_at AS UploadedAt";

        return await connection.QuerySingleOrDefaultAsync<ProjetoDocumento>(
            sql, new { Id = id, ObraId = obraId, Nome = nome, TipoDocumento = tipoDocumento, EtapaId = etapaId });
    }

    public async Task<ProjetoDocumento?> DeleteAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            DELETE FROM projetos_documentos
            WHERE id = @Id AND obra_id = @ObraId
            RETURNING id, obra_id AS ObraId, etapa_id AS EtapaId, nome, storage_key AS StorageKey,
                      tipo_documento AS TipoDocumento, uploaded_at AS UploadedAt";

        return await connection.QuerySingleOrDefaultAsync<ProjetoDocumento>(sql, new { Id = id, ObraId = obraId });
    }
}
