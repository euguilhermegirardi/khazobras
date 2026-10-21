using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class RelatorioFotograficoRepository : IRelatorioFotograficoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RelatorioFotograficoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO relatorios_fotograficos (id, obra_id, tipo, etapa_id, titulo, competencia, created_at)
            VALUES (@Id, @ObraId, @Tipo::relatorio_fotografico_tipo, @EtapaId, @Titulo, @Competencia, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            relatorio.Id,
            relatorio.ObraId,
            relatorio.Tipo,
            relatorio.EtapaId,
            relatorio.Titulo,
            Competencia = relatorio.Competencia?.ToDateTime(TimeOnly.MinValue),
            relatorio.CreatedAt
        });

        return relatorio;
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM relatorios_fotograficos WHERE id = @Id";
        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<RelatorioFotografico?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, tipo, etapa_id AS EtapaId, titulo, competencia, created_at AS CreatedAt
            FROM relatorios_fotograficos
            WHERE id = @Id AND obra_id = @ObraId";

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioRow>(sql, new { Id = id, ObraId = obraId });
        if (row is null)
        {
            return null;
        }

        var relatorio = row.ToEntity();
        relatorio.Fotos = (await GetFotosAsync(connection, [id])).ToList();
        return relatorio;
    }

    public async Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, tipo, etapa_id AS EtapaId, titulo, competencia, created_at AS CreatedAt
            FROM relatorios_fotograficos
            WHERE obra_id = @ObraId
            ORDER BY created_at DESC, id";

        var relatorios = (await connection.QueryAsync<RelatorioRow>(sql, new { ObraId = obraId }))
            .Select(r => r.ToEntity())
            .ToList();

        if (relatorios.Count == 0)
        {
            return relatorios;
        }

        // Uma unica consulta para as fotos de todos os relatorios (sem N+1); os ids ja sao desta obra.
        var fotos = (await GetFotosAsync(connection, relatorios.Select(r => r.Id).ToArray())).ToLookup(f => f.RelatorioFotograficoId);
        foreach (var relatorio in relatorios)
        {
            relatorio.Fotos = fotos[relatorio.Id].ToList();
        }

        return relatorios;
    }

    public async Task<bool> UpdateAsync(RelatorioFotografico relatorio)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE relatorios_fotograficos
            SET tipo = @Tipo::relatorio_fotografico_tipo, etapa_id = @EtapaId, titulo = @Titulo, competencia = @Competencia
            WHERE id = @Id AND obra_id = @ObraId";

        var afetadas = await connection.ExecuteAsync(sql, new
        {
            relatorio.Id,
            relatorio.ObraId,
            relatorio.Tipo,
            relatorio.EtapaId,
            relatorio.Titulo,
            Competencia = relatorio.Competencia?.ToDateTime(TimeOnly.MinValue)
        });
        return afetadas > 0;
    }

    public async Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            // Trava o relatorio ANTES de ler as chaves (mesma trava do upload e da reordenacao): um upload concorrente
            // espera o commit ou ja commitou, entao a lista abaixo inclui todas as fotos que o CASCADE vai apagar.
            const string lockSql = "SELECT id FROM relatorios_fotograficos WHERE id = @Id AND obra_id = @ObraId FOR UPDATE";
            var travado = await connection.QuerySingleOrDefaultAsync<Guid?>(lockSql, new { Id = id, ObraId = obraId }, transaction);
            if (travado is null)
            {
                transaction.Rollback();
                return null;
            }

            const string chavesSql = "SELECT storage_key FROM fotos WHERE relatorio_fotografico_id = @Id";
            var chaves = (await connection.QueryAsync<string>(chavesSql, new { Id = id, ObraId = obraId }, transaction)).ToList();

            // Fotos saem junto por ON DELETE CASCADE (schema 005).
            const string deleteSql = "DELETE FROM relatorios_fotograficos WHERE id = @Id AND obra_id = @ObraId";
            var afetadas = await connection.ExecuteAsync(deleteSql, new { Id = id, ObraId = obraId }, transaction);

            if (afetadas == 0)
            {
                transaction.Rollback();
                return null;
            }

            transaction.Commit();
            return chaves;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<int?> CountFotosAsync(Guid relatorioId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT (SELECT COUNT(*) FROM fotos f WHERE f.relatorio_fotografico_id = r.id)::int
            FROM relatorios_fotograficos r
            WHERE r.id = @RelatorioId AND r.obra_id = @ObraId";

        return await connection.QuerySingleOrDefaultAsync<int?>(sql, new { RelatorioId = relatorioId, ObraId = obraId });
    }

    public async Task<FotoInsertResult> TryAddFotoAsync(Foto foto, Guid obraId, int maxFotos, bool ordemNoFim)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            // Trava a linha do relatorio: outro upload (ou reordenacao) do mesmo relatorio espera o commit, entao a contagem
            // abaixo e confiavel (um COUNT dentro do INSERT, sem trava, deixaria dois uploads passarem do limite).
            const string lockSql = "SELECT id FROM relatorios_fotograficos WHERE id = @RelatorioId AND obra_id = @ObraId FOR UPDATE";
            var travado = await connection.QuerySingleOrDefaultAsync<Guid?>(
                lockSql, new { RelatorioId = foto.RelatorioFotograficoId, ObraId = obraId }, transaction);
            if (travado is null)
            {
                transaction.Rollback();
                return FotoInsertResult.RelatorioNaoEncontrado;
            }

            const string statsSql = @"
                SELECT COUNT(*)::int AS Total, COALESCE(MAX(ordem) + 1, 0) AS ProximaOrdem
                FROM fotos
                WHERE relatorio_fotografico_id = @RelatorioId";
            var stats = await connection.QuerySingleAsync<FotoStatsRow>(statsSql, new { RelatorioId = foto.RelatorioFotograficoId }, transaction);
            if (stats.Total >= maxFotos)
            {
                transaction.Rollback();
                return FotoInsertResult.LimiteExcedido;
            }

            if (ordemNoFim)
            {
                foto.Ordem = stats.ProximaOrdem;
            }

            const string insertSql = @"
                INSERT INTO fotos (id, relatorio_fotografico_id, storage_key, data_foto, descricao, ordem, created_at)
                VALUES (@Id, @RelatorioFotograficoId, @StorageKey, @DataFoto, @Descricao, @Ordem, @CreatedAt)";
            await connection.ExecuteAsync(insertSql, new
            {
                foto.Id,
                foto.RelatorioFotograficoId,
                foto.StorageKey,
                DataFoto = foto.DataFoto?.ToDateTime(TimeOnly.MinValue),
                foto.Descricao,
                foto.Ordem,
                foto.CreatedAt
            }, transaction);

            transaction.Commit();
            return FotoInsertResult.Added;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Guid?> GetObraIdByFotoIdAsync(Guid fotoId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT r.obra_id
            FROM fotos f
            JOIN relatorios_fotograficos r ON r.id = f.relatorio_fotografico_id
            WHERE f.id = @FotoId";

        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { FotoId = fotoId });
    }

    public async Task<Foto?> GetFotoByIdAndObraAsync(Guid fotoId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT f.id, f.relatorio_fotografico_id AS RelatorioFotograficoId, f.storage_key AS StorageKey,
                   f.data_foto AS DataFoto, f.descricao, f.ordem, f.created_at AS CreatedAt
            FROM fotos f
            JOIN relatorios_fotograficos r ON r.id = f.relatorio_fotografico_id
            WHERE f.id = @FotoId AND r.obra_id = @ObraId";

        var row = await connection.QuerySingleOrDefaultAsync<FotoRow>(sql, new { FotoId = fotoId, ObraId = obraId });
        return row?.ToEntity();
    }

    public async Task<Foto?> UpdateFotoAsync(Guid fotoId, Guid obraId, UpdateFotoRequest patch)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Um UPDATE atomico: cada campo so muda se foi informado (CASE), preso a obra pelo JOIN com o relatorio.
        const string sql = @"
            UPDATE fotos f
            SET descricao = CASE WHEN @SetDescricao THEN @Descricao::varchar ELSE f.descricao END,
                data_foto = CASE WHEN @SetDataFoto THEN @DataFoto::date ELSE f.data_foto END,
                ordem     = CASE WHEN @SetOrdem THEN @Ordem::int ELSE f.ordem END
            FROM relatorios_fotograficos r
            WHERE f.id = @FotoId AND r.id = f.relatorio_fotografico_id AND r.obra_id = @ObraId
            RETURNING f.id, f.relatorio_fotografico_id AS RelatorioFotograficoId, f.storage_key AS StorageKey,
                      f.data_foto AS DataFoto, f.descricao, f.ordem, f.created_at AS CreatedAt";

        var row = await connection.QuerySingleOrDefaultAsync<FotoRow>(sql, new
        {
            FotoId = fotoId,
            ObraId = obraId,
            SetDescricao = patch.DescricaoInformada,
            patch.Descricao,
            SetDataFoto = patch.DataFotoInformada,
            DataFoto = patch.DataFoto?.ToDateTime(TimeOnly.MinValue),
            SetOrdem = patch.OrdemInformada,
            patch.Ordem
        });
        return row?.ToEntity();
    }

    public async Task<Foto?> DeleteFotoAsync(Guid fotoId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            DELETE FROM fotos f
            USING relatorios_fotograficos r
            WHERE f.id = @FotoId AND r.id = f.relatorio_fotografico_id AND r.obra_id = @ObraId
            RETURNING f.id, f.relatorio_fotografico_id AS RelatorioFotograficoId, f.storage_key AS StorageKey,
                      f.data_foto AS DataFoto, f.descricao, f.ordem, f.created_at AS CreatedAt";

        var row = await connection.QuerySingleOrDefaultAsync<FotoRow>(sql, new { FotoId = fotoId, ObraId = obraId });
        return row?.ToEntity();
    }

    public async Task<bool> ReordenarFotosAsync(Guid relatorioId, Guid obraId, IReadOnlyList<(Guid Id, int Ordem)> itens)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            // Mesma trava do upload: reordenar e subir foto no mesmo relatorio se enfileiram.
            const string lockSql = "SELECT id FROM relatorios_fotograficos WHERE id = @RelatorioId AND obra_id = @ObraId FOR UPDATE";
            var travado = await connection.QuerySingleOrDefaultAsync<Guid?>(lockSql, new { RelatorioId = relatorioId, ObraId = obraId }, transaction);
            if (travado is null)
            {
                transaction.Rollback();
                return false;
            }

            // So casa fotos DESTE relatorio (que e desta obra); se a contagem nao bater, desfaz tudo.
            const string updateSql = @"
                UPDATE fotos f
                SET ordem = v.ordem
                FROM unnest(@Ids::uuid[], @Ordens::int[]) AS v(id, ordem)
                WHERE f.id = v.id AND f.relatorio_fotografico_id = @RelatorioId";
            var afetadas = await connection.ExecuteAsync(updateSql, new
            {
                Ids = itens.Select(i => i.Id).ToArray(),
                Ordens = itens.Select(i => i.Ordem).ToArray(),
                RelatorioId = relatorioId
            }, transaction);

            if (afetadas != itens.Count)
            {
                transaction.Rollback();
                return false;
            }

            transaction.Commit();
            return true;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private static async Task<IEnumerable<Foto>> GetFotosAsync(System.Data.IDbConnection connection, Guid[] relatorioIds)
    {
        // Ordem estavel: ordem, criacao, id (fotos com a mesma ordem nao trocam de lugar entre leituras).
        const string sql = @"
            SELECT id, relatorio_fotografico_id AS RelatorioFotograficoId, storage_key AS StorageKey,
                   data_foto AS DataFoto, descricao, ordem, created_at AS CreatedAt
            FROM fotos
            WHERE relatorio_fotografico_id = ANY(@RelatorioIds)
            ORDER BY ordem ASC, created_at ASC, id ASC";

        var rows = await connection.QueryAsync<FotoRow>(sql, new { RelatorioIds = relatorioIds });
        return rows.Select(r => r.ToEntity());
    }

    private sealed class FotoStatsRow
    {
        public int Total { get; set; }
        public int ProximaOrdem { get; set; }
    }

    private sealed class RelatorioRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public Guid? EtapaId { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public DateTime? Competencia { get; set; }
        public DateTime CreatedAt { get; set; }

        public RelatorioFotografico ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Tipo = Tipo,
            EtapaId = EtapaId,
            Titulo = Titulo,
            Competencia = Competencia.HasValue ? DateOnly.FromDateTime(Competencia.Value) : null,
            CreatedAt = CreatedAt
        };
    }

    private sealed class FotoRow
    {
        public Guid Id { get; set; }
        public Guid RelatorioFotograficoId { get; set; }
        public string StorageKey { get; set; } = string.Empty;
        public DateTime? DataFoto { get; set; }
        public string? Descricao { get; set; }
        public int Ordem { get; set; }
        public DateTime CreatedAt { get; set; }

        public Foto ToEntity() => new()
        {
            Id = Id,
            RelatorioFotograficoId = RelatorioFotograficoId,
            StorageKey = StorageKey,
            DataFoto = DataFoto.HasValue ? DateOnly.FromDateTime(DataFoto.Value) : null,
            Descricao = Descricao,
            Ordem = Ordem,
            CreatedAt = CreatedAt
        };
    }
}
