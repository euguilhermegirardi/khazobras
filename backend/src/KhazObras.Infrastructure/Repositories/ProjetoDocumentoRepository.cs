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

    public async Task<ProjetoDocumento?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, etapa_id AS EtapaId, nome, storage_key AS StorageKey,
                   tipo_documento AS TipoDocumento, uploaded_at AS UploadedAt
            FROM projetos_documentos
            WHERE id = @Id";

        return await connection.QuerySingleOrDefaultAsync<ProjetoDocumento>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, etapa_id AS EtapaId, nome, storage_key AS StorageKey,
                   tipo_documento AS TipoDocumento, uploaded_at AS UploadedAt
            FROM projetos_documentos
            WHERE obra_id = @ObraId
            ORDER BY uploaded_at DESC";

        var rows = await connection.QueryAsync<ProjetoDocumento>(sql, new { ObraId = obraId });
        return rows.ToList();
    }
}