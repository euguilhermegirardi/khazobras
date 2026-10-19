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

    public async Task<ProjetoDocumento> CreateAsync(ProjetoDocumento documento)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO projetos_documentos (id, obra_id, etapa_id, nome, storage_key, tipo_documento, uploaded_at)
            VALUES (@Id, @ObraId, @EtapaId, @Nome, @StorageKey, @TipoDocumento, @UploadedAt)";

        await connection.ExecuteAsync(sql, documento);
        return documento;
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

        const string sql = @"
            SELECT d.id, d.obra_id AS ObraId, d.etapa_id AS EtapaId, d.nome, d.storage_key AS StorageKey,
                   d.tipo_documento AS TipoDocumento, d.uploaded_at AS UploadedAt
            FROM projetos_documentos d
            LEFT JOIN etapas e ON e.id = d.etapa_id AND e.obra_id = d.obra_id
            WHERE d.obra_id = @ObraId
            ORDER BY e.ordem ASC NULLS LAST, d.uploaded_at DESC, d.nome ASC";

        var rows = await connection.QueryAsync<ProjetoDocumento>(sql, new { ObraId = obraId });
        return rows.ToList();
    }
}